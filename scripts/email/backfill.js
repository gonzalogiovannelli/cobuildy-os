// Backfill email conversations into per-person interaction logs.
//
// For each email since CUTOFF_DATE, in INBOX and Sent folders:
//   1. parse from/to/cc addresses
//   2. for any address that matches a person.md `Email:` field,
//      summarize the body with Claude (1-2 lines) and append a log
//      entry to /data/people/logs/<slug>.md
//   3. one entry per message (per-message granularity)
//   4. unknown senders are silently skipped (no orphan persons created)
//
// Idempotent: rebuildPersonLog dedupes on the first 80 chars of each
// entry, so re-runs collapse rather than stack.
//
// Modes:
//   default → dry run (no writes, no API calls)
//   --apply → call Claude + write to logs

const path = require('path');
const fs   = require('fs');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const imapSimple    = require('imap-simple');
const { simpleParser } = require('mailparser');
const _sdk          = require('@anthropic-ai/sdk');
const Anthropic     = _sdk.default ?? _sdk;

const {
  PEOPLE_DIR,
  rebuildPersonLog,
} = require('../entity/persist.js');

const CUTOFF_DATE   = '2026-03-17';      // user joined this date; nothing older
// IONOS Spanish account: Sent is "Elementos enviados". The fallback regex
// in main() also catches "/sent/i" and "/enviados/i" for safety.
const FOLDERS       = ['INBOX', 'Elementos enviados'];
const BODY_LIMIT    = 1500;              // chars sent to Claude per email
const REQ_DELAY_MS  = 100;
const MY_EMAIL      = (process.env.IMAP_USER || '').toLowerCase();

const apply = process.argv.includes('--apply');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Person map ───────────────────────────────────────────────────────────────

function loadEmailToSlugMap() {
  const map = new Map();
  if (!fs.existsSync(PEOPLE_DIR)) return map;
  for (const f of fs.readdirSync(PEOPLE_DIR)) {
    if (!f.endsWith('.md') || f.startsWith('_template_')) continue;
    const slug = f.replace(/\.md$/, '');
    const text = fs.readFileSync(path.join(PEOPLE_DIR, f), 'utf8').replace(/\r\n/g, '\n');
    const m = text.match(/^- \*\*Email:\*\*[ \t]*([^\n]*)$/m);
    if (m) {
      const email = m[1].trim().toLowerCase();
      if (email) map.set(email, slug);
    }
  }
  return map;
}

// ── IMAP helpers ─────────────────────────────────────────────────────────────

function imapConfig() {
  return {
    imap: {
      user:        process.env.IMAP_USER,
      password:    process.env.IMAP_PASSWORD,
      host:        process.env.IMAP_HOST || 'imap.ionos.com',
      port:        parseInt(process.env.IMAP_PORT || '993'),
      tls:         true,
      authTimeout: 20000,
    },
  };
}

// IMAP date format is "DD-MMM-YYYY". For 2026-03-17 → "17-Mar-2026".
function toImapDate(iso) {
  const d = new Date(iso);
  const day   = String(d.getDate()).padStart(2, '0');
  const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  const year  = d.getFullYear();
  return `${day}-${month}-${year}`;
}

async function listMailboxFolders(connection) {
  const boxes = await connection.getBoxes();
  const flat  = [];
  function walk(tree, prefix = '') {
    for (const [name, info] of Object.entries(tree)) {
      const full = prefix + name;
      flat.push(full);
      if (info.children) walk(info.children, full + (info.delimiter || '.'));
    }
  }
  walk(boxes);
  return flat;
}

async function fetchSince(connection, folder, sinceImap) {
  await connection.openBox(folder);
  // SINCE matches messages received on or after the date.
  const msgs = await connection.search([['SINCE', sinceImap]], {
    bodies: [''],
    struct: true,
  });
  return msgs;
}

// Extract a list of normalised addresses from a parsed mailparser address object.
function flattenAddresses(addrField) {
  if (!addrField) return [];
  const arr = Array.isArray(addrField) ? addrField : [addrField];
  const out = [];
  for (const a of arr) {
    if (a.value) {
      for (const v of a.value) if (v.address) out.push(v.address.toLowerCase());
    } else if (a.address) {
      out.push(a.address.toLowerCase());
    }
  }
  return out;
}

// ── Body cleanup ─────────────────────────────────────────────────────────────

function cleanBody(text) {
  if (!text) return '';
  // Strip quoted-reply blocks: drop everything from common reply markers down.
  const cutters = [
    /^On .+ wrote:$/m,
    /^El .+ escribió:$/m,
    /^Le .+ a écrit :$/m,
    /^From: .+\nSent: .+/m,
    /^De: .+\nEnviado: .+/m,
    /^-{2,}\s*Original Message\s*-{2,}/m,
  ];
  let cleaned = text;
  for (const re of cutters) {
    const m = cleaned.match(re);
    if (m) cleaned = cleaned.slice(0, m.index);
  }
  // Remove quoted lines (>) and signature dashes
  cleaned = cleaned.split('\n')
    .filter(l => !/^>/.test(l.trim()))
    .join('\n');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned.slice(0, BODY_LIMIT);
}

// ── Claude summary ───────────────────────────────────────────────────────────

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function summarize(direction, subject, body) {
  if (!body || body.length < 20) {
    return subject ? `(${subject})` : '(empty body)';
  }
  const prompt = [
    `An email was ${direction === 'sent' ? 'sent' : 'received'} as part of an outreach pipeline.`,
    `Subject: ${subject}`,
    `Body:\n${body}`,
    ``,
    `Write ONE concise line (max ~120 chars) summarising what was discussed and any committed next step.`,
    `Reply in the language of the email body (Spanish if Spanish, English if English).`,
    `Output only the summary, no preamble.`,
  ].join('\n');

  const res = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 200,
    messages:   [{ role: 'user', content: prompt }],
  });
  const txt = res.content.find(b => b.type === 'text')?.text?.trim() || '';
  // Single-line, max 120 chars.
  const single = txt.split(/\r?\n/)[0].trim();
  return single.length > 120 ? single.slice(0, 117).trimEnd() + '…' : single;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Mode: ${apply ? '⚡ APPLY' : '🔍 DRY RUN'}`);
  console.log(`Cutoff: ${CUTOFF_DATE}\n`);

  const emailMap = loadEmailToSlugMap();
  console.log(`Loaded ${emailMap.size} person email(s) from /data/people/`);
  if (emailMap.size === 0) {
    console.log('No persons with email — nothing to backfill.');
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY missing in scripts/.env');
    process.exit(1);
  }

  const connection = await imapSimple.connect(imapConfig());
  try {
    const allFolders = await listMailboxFolders(connection);
    const folders    = FOLDERS.filter(f => allFolders.includes(f))
      .concat(allFolders.filter(f => /sent|enviados/i.test(f) && !FOLDERS.includes(f)));
    const unique     = [...new Set(folders)];
    console.log(`Folders to scan: ${unique.join(', ')}\n`);

    const sinceImap = toImapDate(CUTOFF_DATE);

    // entries: Map<slug, Array<entryString>>
    const entries = new Map();
    function addEntry(slug, line) {
      if (!entries.has(slug)) entries.set(slug, []);
      entries.get(slug).push(line);
    }

    let totalScanned = 0, totalMatched = 0, totalProcessed = 0;

    for (const folder of unique) {
      console.log(`\n=== Scanning ${folder} ===`);
      let msgs;
      try {
        msgs = await fetchSince(connection, folder, sinceImap);
      } catch (err) {
        console.error(`  ✗ Could not open ${folder}: ${err.message}`);
        continue;
      }
      console.log(`  ${msgs.length} message(s) since ${sinceImap}`);
      totalScanned += msgs.length;

      for (const m of msgs) {
        const raw = m.parts.find(p => p.which === '')?.body;
        if (!raw) continue;
        let parsed;
        try { parsed = await simpleParser(raw); } catch { continue; }

        const date    = parsed.date ? parsed.date.toISOString().slice(0, 10) : '';
        const subject = parsed.subject || '(no subject)';
        const fromAddrs = flattenAddresses(parsed.from);
        const toAddrs   = [...flattenAddresses(parsed.to), ...flattenAddresses(parsed.cc), ...flattenAddresses(parsed.bcc)];

        // Determine direction:
        //   sent     → MY_EMAIL is in From, and at least one recipient is a known person
        //   received → recipient includes MY_EMAIL, and From is a known person
        const meIsSender   = fromAddrs.includes(MY_EMAIL);
        const meIsRecipient = toAddrs.includes(MY_EMAIL);

        const matchedSlugs = new Set();
        if (meIsSender) {
          for (const a of toAddrs) {
            const s = emailMap.get(a);
            if (s) matchedSlugs.add(s);
          }
        }
        if (!meIsSender || meIsRecipient) {
          // received (or both — meeting participant CC'd themselves)
          for (const a of fromAddrs) {
            const s = emailMap.get(a);
            if (s) matchedSlugs.add(s);
          }
        }

        if (matchedSlugs.size === 0) continue;

        totalMatched++;
        const direction = meIsSender ? 'sent' : 'received';

        let summary;
        if (apply) {
          try {
            const cleaned = cleanBody(parsed.text || parsed.html || '');
            summary = await summarize(direction, subject, cleaned);
          } catch (err) {
            console.error(`  ✗ Summary failed for "${subject}": ${err.message}`);
            summary = subject;
          }
          await sleep(REQ_DELAY_MS);
        } else {
          summary = subject; // dry run uses subject for preview
        }

        const tag  = direction === 'sent' ? 'Email (sent)' : 'Email (received)';
        for (const slug of matchedSlugs) {
          const line = `${date} | ${tag} | ${summary} | `;
          addEntry(slug, line);
          totalProcessed++;
        }
      }
    }

    // Write results
    console.log(`\n=== Summary ===`);
    console.log(`  Scanned:   ${totalScanned}`);
    console.log(`  Matched:   ${totalMatched}`);
    console.log(`  Entries:   ${totalProcessed} (some emails hit multiple persons)`);
    console.log();
    for (const [slug, lines] of entries.entries()) {
      console.log(`  ${slug}: ${lines.length} entry/entries`);
      if (apply) rebuildPersonLog(slug, lines);
    }
    if (!apply) console.log('\nRe-run with --apply to call Claude and write the logs.');
  } finally {
    connection.end();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
