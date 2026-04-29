// Backfill Aircall calls into per-person interaction logs.
//
// Without Voice Intelligence access (paid feature), each entry is just
// metadata: direction, duration, who handled it on our team, and the
// recording link if present. Useful as a touchpoint timestamp; the full
// content is in the recording, accessible via the link.
//
// Match: Aircall's `raw_digits` (the external phone) is normalised and
// looked up against person.md `Phone:` and `WhatsApp:` fields.
//
// Modes:
//   default → dry run (no writes)
//   --apply → write entries to /data/people/logs/<slug>.md

const path = require('path');
const fs   = require('fs');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { paginateCalls } = require('./aircall.js');
const { normalizePhone } = require('../entity/match.js');
const { PEOPLE_DIR, rebuildPersonLog } = require('../entity/persist.js');

const CUTOFF_DATE = '2026-03-17';
const apply = process.argv.includes('--apply');

function fmtDate(unix) {
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

function fmtDuration(seconds) {
  if (!seconds || seconds <= 0) return '0s';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}m${String(s).padStart(2, '0')}` : `${m}m`;
}

// Read all person.md and build a phone → [slug] map. Same phone in
// multiple persons is rare but supported (returned as a list).
function loadPhoneToSlugs() {
  const map = new Map();
  if (!fs.existsSync(PEOPLE_DIR)) return map;
  for (const f of fs.readdirSync(PEOPLE_DIR)) {
    if (!f.endsWith('.md') || f.startsWith('_template_')) continue;
    const slug = f.replace(/\.md$/, '');
    const text = fs.readFileSync(path.join(PEOPLE_DIR, f), 'utf8').replace(/\r\n/g, '\n');
    const fields = ['Phone', 'WhatsApp'];
    const phones = [];
    for (const fld of fields) {
      const re = new RegExp(`^- \\*\\*${fld}:\\*\\*[ \\t]*([^\\n]*)$`, 'm');
      const m = text.match(re);
      if (m && m[1].trim()) phones.push(m[1].trim());
    }
    for (const p of phones) {
      const n = normalizePhone(p);
      if (!n) continue;
      if (!map.has(n)) map.set(n, []);
      if (!map.get(n).includes(slug)) map.get(n).push(slug);
    }
  }
  return map;
}

async function main() {
  console.log(`Mode: ${apply ? '⚡ APPLY' : '🔍 DRY RUN'}`);
  console.log(`Cutoff: ${CUTOFF_DATE}\n`);

  const phoneMap = loadPhoneToSlugs();
  console.log(`Loaded ${phoneMap.size} normalised phone(s) from /data/people/`);
  if (phoneMap.size === 0) {
    console.log('No persons with phone — nothing to backfill.');
    return;
  }

  const fromUnix = Math.floor(new Date(CUTOFF_DATE).getTime() / 1000);
  const toUnix   = Math.floor(Date.now() / 1000);

  // Group entries by person slug for batch write
  const entriesBySlug = new Map();
  function add(slug, entry) {
    if (!entriesBySlug.has(slug)) entriesBySlug.set(slug, []);
    entriesBySlug.get(slug).push(entry);
  }

  let scanned = 0, matched = 0;

  console.log(`\nScanning Aircall calls...`);
  for await (const call of paginateCalls({ fromUnix, toUnix })) {
    scanned++;
    const phoneNorm = normalizePhone(call.raw_digits || '');
    if (!phoneNorm) continue;
    const slugs = phoneMap.get(phoneNorm);
    if (!slugs || slugs.length === 0) continue;

    matched++;
    const date       = fmtDate(call.started_at);
    const dur        = fmtDuration(call.duration);
    const userName   = call.user?.name || '?';
    const direction  = call.direction || 'unknown';
    // `asset` is a permanent URL of the form
    //   https://assets.aircall.io/calls/<id>/recording
    // that redirects (after Aircall auth) to a fresh signed audio URL.
    // Preferred over `recording` (one-shot signed URL, expires in min)
    // and over `recording_short_url` (often empty on non-VI plans).
    const audioLink  = call.asset || call.recording_short_url || '';
    const marker     = `<!-- aircall:${call.id} -->`;

    let summary, nextAction;
    if (!call.answered_at || call.duration < 5) {
      summary    = `(${direction}, ${dur}) no answer`;
      nextAction = `#${call.id}`;
    } else {
      summary    = `(${direction}, ${dur}) handled by @${userName}`;
      nextAction = audioLink
        ? `#${call.id} · [audio](${audioLink})`
        : `#${call.id}`;
    }

    const entry = `${date} | Call | ${summary} | ${nextAction} ${marker}`;
    for (const slug of slugs) add(slug, entry);
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Scanned:        ${scanned}`);
  console.log(`  Matched person: ${matched}`);
  console.log(`  Unique people:  ${entriesBySlug.size}\n`);

  for (const [slug, entries] of entriesBySlug.entries()) {
    console.log(`  ${slug}: ${entries.length} call(s)`);
    // replace=true: overwrite any existing entry with the same aircall:ID
    // marker. Lets us safely re-run after format changes without dupes.
    if (apply) rebuildPersonLog(slug, entries, { replace: true });
  }

  if (!apply) console.log('\nRe-run with --apply to write the logs.');
}

main().catch(e => { console.error(e.message); process.exit(1); });
