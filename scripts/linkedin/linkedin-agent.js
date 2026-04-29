// LinkedIn agent — converts warm outreach leads (Reply received = TRUE in
// the Developers tab) into person.md / company.md records.
//
// Idempotent: a second run on the same warm row finds the existing person
// via entity matching and just refreshes `Last LinkedIn`. No duplicates.
//
// Scope (v1):
//   - Only the Developers tab. Investors handled separately later.
//   - Only rows with column L = TRUE. Pre-warm rows are ignored.
//   - Dani's parallel outreach (cols M-N) is ignored.

const path = require('path');
const fs   = require('fs');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { readDevelopersTab } = require('./sheet.js');
const { findPersonMatches, findCompanyMatches } = require('../entity/match.js');
const { createLeadComplex, addNote } = require('../kommo/kommo.js');
const {
  PEOPLE_DIR, COMPANIES_DIR,
  today, slugify, setFields, readTemplate,
  fillCompanyMd,
  updatePersonFields,
  logEntry, logInteraction, appendPersonLog,
} = require('../entity/persist.js');

const SHEET_ID = process.env.LINKEDIN_SHEET_ID
  || '1cR51zYulygDUKc8dEATWsv3ksMMJf7H56clXsDsO6vY';

// Kommo destination for warm LinkedIn leads. IDs from
// scripts/_kommo_smoke.js validation run; can be overridden via env.
const KOMMO_PIPELINE_ID    = parseInt(process.env.KOMMO_LINKEDIN_PIPELINE_ID    || '13581344',  10);
const KOMMO_WARM_STATUS_ID = parseInt(process.env.KOMMO_LINKEDIN_WARM_STATUS_ID || '105198184', 10);

// Custom field IDs in this Kommo account (from inspection)
const CF_CONTACT_LINKEDIN = 698818;
const CF_CONTACT_POSITION = 619300;

// "4/24/2026" → "2026-04-24"
function parseDate(s) {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

function fillPersonMdLinkedIn(row, companySlug, firstContactDate) {
  const date = today();
  let text = readTemplate(path.join(PEOPLE_DIR, '_template_person.md'));
  text = text.replace('# [Full Name]', `# ${row.employeeName}`);
  text = setFields(text, {
    'Email':              '',
    'Phone':              '',
    'WhatsApp':           '',
    'LinkedIn':           row.employeeLink,
    'Role':               'promoter',
    'Investor ID':        '',
    'Channel':            'linkedin',
    'Language':           '',
    'First contact date': firstContactDate || date,
    'Current stage':      'prospecting',
    'Last updated':       date,
    'Active projects':    '',
    'Last email':         '',
    'Last call':          '',
    'Last meet':          '',
    'Last LinkedIn':      date,
    'Last Kommo':         '',
    'Notes':              row.info || '',
    'Projects':           '',
  });
  // Company appears in two places with different formats — fill both.
  text = text.replace(
    /- \*\*Company:\*\* \[company_name\.md\]/,
    companySlug ? `- **Company:** [${companySlug}.md](/data/companies/${companySlug}.md)` : '- **Company:** '
  );
  text = text.replace(
    /- \*\*Company:\*\* \/data\/companies\/company_name\.md/,
    companySlug ? `- **Company:** /data/companies/${companySlug}.md` : '- **Company:** '
  );
  return text;
}

// Read the "Kommo Lead ID" field from an existing person.md (returns null
// if not set yet). Used to make Kommo push idempotent.
function readKommoLeadId(personSlug) {
  const fs = require('fs');
  const filePath = path.join(PEOPLE_DIR, `${personSlug}.md`);
  if (!fs.existsSync(filePath)) return null;
  const text = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  // [ \t]* matches only horizontal whitespace — \s* would greedily eat the
  // newline too and capture content from the next line.
  const m = text.match(/^- \*\*Kommo Lead ID:\*\*[ \t]*([^\n]*)$/m);
  if (!m) return null;
  const v = m[1].trim();
  return v ? v : null;
}

// Build the body of the [Cobuildy OS] note posted to the Kommo lead.
function buildKommoNote(row, personSlug) {
  const lines = [
    '[Cobuildy OS] Warm lead via LinkedIn outreach',
    '',
    `Channel: LinkedIn (Sales Navigator)`,
    `Company: ${row.companyName || '(no company)'}`,
  ];
  if (row.info) lines.push(`Info: ${row.info}`);
  if (row.connectionSent) lines.push(`Connection sent: ${row.connectionSent}`);
  lines.push(`Reply received: ${today()}`);
  lines.push('');
  lines.push(`Detalles en repo: /data/people/${personSlug}.md`);
  return lines.join('\n');
}

// Push a freshly-warm linkedin lead into Kommo (creates Lead + Contact +
// Company + first note atomically) and store the resulting IDs in the
// person.md. Idempotent — if person.md already has a Kommo Lead ID, we
// just append a fresh note instead of creating a duplicate lead.
async function pushToKommo(row, personSlug) {
  const existingLeadId = readKommoLeadId(personSlug);
  const noteText = buildKommoNote(row, personSlug);

  if (existingLeadId) {
    try {
      await addNote(existingLeadId, noteText);
      console.log(`  ↻ Refreshed Kommo lead ${existingLeadId} with new note`);
    } catch (err) {
      console.error(`  ✗ Kommo addNote failed: ${err.message}`);
    }
    return;
  }

  // First, last name split (single-space; Spanish double last names stay as one).
  const parts = row.employeeName.trim().split(/\s+/);
  const firstName = parts[0] || '';
  const lastName  = parts.slice(1).join(' ');

  const contactCustomFields = [];
  if (row.employeeLink) {
    contactCustomFields.push({ field_id: CF_CONTACT_LINKEDIN, values: [{ value: row.employeeLink }] });
  }

  const leadName = row.companyName ? `${row.employeeName}/${row.companyName}` : row.employeeName;

  let result;
  try {
    result = await createLeadComplex({
      name:       leadName,
      pipelineId: KOMMO_PIPELINE_ID,
      statusId:   KOMMO_WARM_STATUS_ID,
      contact: {
        firstName,
        lastName,
        customFields: contactCustomFields.length ? contactCustomFields : undefined,
      },
      company: row.companyName ? { name: row.companyName } : null,
    });
  } catch (err) {
    console.error(`  ✗ Kommo createLeadComplex failed: ${err.message}`);
    return;
  }

  // Save the Kommo IDs back on person.md so subsequent runs are idempotent
  // and other agents can address the lead by ID.
  updatePersonFields(personSlug, {
    'Kommo Lead ID':    result.id,
    'Kommo Contact ID': result.contact_id || '',
  });
  console.log(`  ✓ Created Kommo lead ${result.id} (contact ${result.contact_id}, company ${result.company_id})`);

  try {
    await addNote(result.id, noteText);
    console.log(`  ✓ Posted [Cobuildy OS] note on Kommo lead ${result.id}`);
  } catch (err) {
    console.error(`  ✗ Kommo addNote failed: ${err.message}`);
  }
}

function resolveCompany(companyName, personSlug, personName) {
  if (!companyName) return null;
  const matches = findCompanyMatches({ name: companyName });
  const top = matches[0];
  if (top && top.confidence >= 90) {
    console.log(`  i Matched company ${top.slug} (${top.confidence}% — ${top.reason})`);
    return top.slug;
  }
  const newSlug = slugify(companyName);
  const filePath = path.join(COMPANIES_DIR, `${newSlug}.md`);
  if (fs.existsSync(filePath)) {
    console.log(`  i Company file ${newSlug}.md already exists — reusing`);
    return newSlug;
  }
  fs.writeFileSync(filePath, fillCompanyMd(companyName, personSlug, personName, null));
  console.log(`  ✓ Created data/companies/${newSlug}.md`);
  return newSlug;
}

async function processWarmRow(row) {
  console.log(`\n→ ${row.employeeName} @ ${row.companyName || '(no company)'}`);

  const candidate = {
    name:    row.employeeName,
    company: row.companyName,
  };
  const matches = findPersonMatches(candidate);
  const top = matches[0];

  // Existing match — just refresh LinkedIn fields, log, done.
  if (top && top.confidence >= 90) {
    console.log(`  i Matched ${top.slug} (${top.confidence}% — ${top.reason})`);
    updatePersonFields(top.slug, {
      'LinkedIn':      row.employeeLink,
      'Last LinkedIn': today(),
      'Last updated':  today(),
    });
    logInteraction(
      top.slug,
      logEntry('LinkedIn', `warm reply via outreach to ${row.companyName}`, 'first conversation'),
    );
    console.log(`  ↻ Refreshed LinkedIn fields on ${top.slug}.md`);
    await pushToKommo(row, top.slug);
    return;
  }

  // New person — create company first (if any) so the link exists.
  const personSlug      = slugify(row.employeeName);
  const firstContactStr = parseDate(row.connectionSent);
  const companySlug     = resolveCompany(row.companyName, personSlug, row.employeeName);

  const personPath = path.join(PEOPLE_DIR, `${personSlug}.md`);
  if (fs.existsSync(personPath)) {
    console.log(`  i Person file ${personSlug}.md already exists — refreshing fields only`);
    updatePersonFields(personSlug, {
      'LinkedIn':      row.employeeLink,
      'Last LinkedIn': today(),
      'Last updated':  today(),
    });
  } else {
    fs.writeFileSync(personPath, fillPersonMdLinkedIn(row, companySlug, firstContactStr));
    console.log(`  ✓ Created data/people/${personSlug}.md`);
  }

  appendPersonLog(
    personSlug,
    logEntry('LinkedIn', `warm reply via outreach to ${row.companyName}`, 'first conversation'),
  );

  await pushToKommo(row, personSlug);
}

async function main() {
  console.log(`Reading LinkedIn sheet (Developers tab): ${SHEET_ID}`);
  const rows = await readDevelopersTab(SHEET_ID);
  const warm = rows.filter(r => r.replyReceived);
  console.log(`${rows.length} rows total; ${warm.length} warm.\n`);

  if (warm.length === 0) {
    console.log('No warm leads to process.');
    return;
  }

  for (const row of warm) {
    try {
      await processWarmRow(row);
    } catch (err) {
      console.error(`  ✗ Error processing ${row.employeeName}: ${err.message}`);
    }
  }

  console.log(`\nDone. Processed ${warm.length} warm lead(s).`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
