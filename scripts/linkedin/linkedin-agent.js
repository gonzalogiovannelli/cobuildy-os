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
const {
  PEOPLE_DIR, COMPANIES_DIR,
  today, slugify, setFields, readTemplate,
  fillCompanyMd,
  updatePersonFields,
  logEntry, logInteraction, appendPersonLog,
} = require('../entity/persist.js');

const SHEET_ID = process.env.LINKEDIN_SHEET_ID
  || '1cR51zYulygDUKc8dEATWsv3ksMMJf7H56clXsDsO6vY';

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
