// Backfill Kommo lead notes into per-person interaction logs.
//
// For every /data/people/<slug>.md that has a Kommo Lead ID, fetch the
// lead's notes from the Kommo API, filter out our own [Cobuildy OS]
// notes (house rule: agent-written notes carry that prefix) and any
// auto-generated message types, then write the surviving (human-written)
// notes to /data/people/logs/<slug>.md sorted newest-first.
//
// Idempotent: rebuildPersonLog dedupes on the first 80 chars of each
// entry, so re-runs collapse duplicates instead of stacking them.
//
// Modes:
//   default       → dry run (lists what would be written, no writes)
//   --apply       → actually write to the log files

const fs   = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { getLeadNotes } = require('./kommo.js');
const {
  PEOPLE_DIR, PEOPLE_LOGS_DIR,
  rebuildPersonLog, ensurePersonLog,
} = require('../entity/persist.js');

const apply = process.argv.includes('--apply');
const REQ_DELAY_MS = 150;

const sleep = ms => new Promise(r => setTimeout(r, ms));

// note_type values to keep. 'common' is human-written notes; 'extended_service'
// covers some integration notes that may carry useful info; everything else
// (service_message, message_cashier, attachment_message_received, etc.) is
// auto-generated and skipped.
const KEEP_TYPES = new Set(['common', 'extended_service']);

function readKommoLeadId(personSlug) {
  const filePath = path.join(PEOPLE_DIR, `${personSlug}.md`);
  if (!fs.existsSync(filePath)) return null;
  const text = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  const m = text.match(/^- \*\*Kommo Lead ID:\*\*[ \t]*([^\n]*)$/m);
  if (!m) return null;
  const v = m[1].trim();
  return v ? v : null;
}

function listPeopleWithKommoIds() {
  const out = [];
  if (!fs.existsSync(PEOPLE_DIR)) return out;
  for (const f of fs.readdirSync(PEOPLE_DIR)) {
    if (!f.endsWith('.md') || f.startsWith('_template_')) continue;
    const slug = f.replace(/\.md$/, '');
    const leadId = readKommoLeadId(slug);
    if (leadId) out.push({ slug, leadId });
  }
  return out;
}

// Truncate to a single line, max ~120 chars. Multi-line notes get the
// first non-empty line.
function tidyNoteText(text) {
  if (!text) return '';
  const single = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean).join(' ');
  return single.length > 120 ? single.slice(0, 117).trimEnd() + '…' : single;
}

function isOurOwnNote(text) {
  return /^\s*\[Cobuildy\s*OS\]/.test(text || '');
}

async function main() {
  console.log(`Mode: ${apply ? '⚡ APPLY' : '🔍 DRY RUN'}\n`);

  const people = listPeopleWithKommoIds();
  console.log(`Found ${people.length} person.md files with Kommo Lead ID.\n`);

  let total = 0, kept = 0, skipped = 0;

  for (const { slug, leadId } of people) {
    let notes;
    try {
      notes = await getLeadNotes(leadId);
    } catch (err) {
      console.error(`  ✗ ${slug} (lead ${leadId}): ${err.message}`);
      continue;
    }
    await sleep(REQ_DELAY_MS);

    const entries = [];
    for (const n of notes || []) {
      total++;
      if (!KEEP_TYPES.has(n.type)) { skipped++; continue; }
      if (isOurOwnNote(n.text)) { skipped++; continue; }
      const tidy = tidyNoteText(n.text);
      if (!tidy) { skipped++; continue; }
      const date = n.created_at;  // already YYYY-MM-DD via fmtDate in kommo.js
      const entry = `${date} | Kommo | ${tidy} | (by ${n.created_by})`;
      entries.push(entry);
      kept++;
    }

    if (entries.length === 0) {
      console.log(`  · ${slug}: no human notes (${notes?.length || 0} total, all filtered)`);
      continue;
    }

    console.log(`  ✓ ${slug}: ${entries.length} note(s) to log`);
    if (apply) rebuildPersonLog(slug, entries);
  }

  console.log(`\n=== Done ===`);
  console.log(`  Notes seen:    ${total}`);
  console.log(`  Notes kept:    ${kept}`);
  console.log(`  Notes skipped: ${skipped} (auto-generated, [Cobuildy OS] or empty)`);
  if (!apply) console.log('\nRe-run with --apply to write to the log files.');
}

main().catch(err => { console.error(err.message); process.exit(1); });
