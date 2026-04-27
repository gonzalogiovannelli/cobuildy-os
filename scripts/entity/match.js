// Shared entity matching for people and companies.
//
// Each agent (email, kommo, aircall, granola, linkedin) feeds in whatever
// signals it has (name, email, phone, company) and gets back ranked matches.
// The caller decides what to do based on confidence — see BRD section 5.2.
//
// Confidence scale (matches BRD):
//   100  email exact OR phone exact
//    90  full name + company
//    70  full name only
//    30  first name only
//
// Threshold for "is this a match worth showing": 25 by default.

const fs   = require('fs');
const path = require('path');

const PEOPLE_DIR    = path.join(__dirname, '..', '..', 'data', 'people');
const COMPANIES_DIR = path.join(__dirname, '..', '..', 'data', 'companies');

// ── Normalization ────────────────────────────────────────────────────────────

// For email comparison: lowercase + trim only (preserve dots, @, etc.)
function normalizeEmail(s) {
  return String(s || '').toLowerCase().trim();
}

// For name/company comparison: strip accents, lowercase, and collapse any
// non-alphanumeric run (spaces, dots, commas, S.L., underscores from slugs)
// into a single space. So "NZ Promoción S.L." and "nz_promocion_s_l" both
// normalize to "nz promocion s l".
function normalize(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Strip non-digits and common ES/PT country prefixes so "+34 600 123 456",
// "0034600123456" and "600123456" all collapse to the same key.
function normalizePhone(p) {
  if (!p) return '';
  let digits = String(p).replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);     // international call prefix
  if (digits.startsWith('34')  && digits.length === 11) return digits.slice(2);
  if (digits.startsWith('351') && digits.length === 12) return digits.slice(3);
  return digits;
}

// ── File parsing ─────────────────────────────────────────────────────────────

// Pull the value sitting after "- **Field:**" on a markdown bullet line.
function readField(text, field) {
  const safe = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re   = new RegExp(`^- \\*\\*${safe}:\\*\\*\\s*(.*)$`, 'm');
  const m    = text.match(re);
  return m ? m[1].trim() : '';
}

function parsePersonFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  const titleMatch = text.match(/^#\s+(.+)$/m);
  const companyRaw = readField(text, 'Company');
  // Company in Role section may be a markdown link "[slug.md](/data/...)"; strip to plain text
  const companyClean = companyRaw
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\.md$/, '')
    .replace(/_/g, ' ')
    .trim();
  return {
    file:    filePath,
    slug:    path.basename(filePath, '.md'),
    name:    titleMatch ? titleMatch[1].trim() : '',
    email:   readField(text, 'Email'),
    phone:   readField(text, 'Phone'),
    company: companyClean,
  };
}

function parseCompanyFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  const titleMatch = text.match(/^#\s+(.+)$/m);
  return {
    file:        filePath,
    slug:        path.basename(filePath, '.md'),
    name:        titleMatch ? titleMatch[1].trim() : '',
    legalName:   readField(text, 'Legal name'),
    nif:         readField(text, 'NIF/CIF'),
  };
}

function listPeople() {
  if (!fs.existsSync(PEOPLE_DIR)) return [];
  return fs.readdirSync(PEOPLE_DIR)
    .filter(f => f.endsWith('.md') && !f.startsWith('_template_'))
    .map(f => parsePersonFile(path.join(PEOPLE_DIR, f)));
}

function listCompanies() {
  if (!fs.existsSync(COMPANIES_DIR)) return [];
  return fs.readdirSync(COMPANIES_DIR)
    .filter(f => f.endsWith('.md') && !f.startsWith('_template_'))
    .map(f => parseCompanyFile(path.join(COMPANIES_DIR, f)));
}

// ── Scoring ──────────────────────────────────────────────────────────────────

function scorePerson(candidate, existing) {
  const candPhone = normalizePhone(candidate.phone);
  const exPhone   = normalizePhone(existing.phone);
  if (candPhone && exPhone && candPhone === exPhone) {
    return { confidence: 100, reason: `phone (${candPhone})` };
  }

  const candEmail = normalizeEmail(candidate.email);
  const exEmail   = normalizeEmail(existing.email);
  if (candEmail && exEmail && candEmail === exEmail) {
    return { confidence: 100, reason: `email (${candEmail})` };
  }

  const candName = normalize(candidate.name);
  const exName   = normalize(existing.name);
  if (!candName || !exName) return { confidence: 0, reason: '' };

  const candCompany = normalize(candidate.company);
  const exCompany   = normalize(existing.company);
  if (candName === exName) {
    if (candCompany && exCompany && candCompany === exCompany) {
      return { confidence: 90, reason: `full name + company` };
    }
    return { confidence: 70, reason: `full name` };
  }

  const candFirst = candName.split(' ')[0];
  const exFirst   = exName.split(' ')[0];
  if (candFirst && exFirst && candFirst === exFirst && candFirst.length > 1) {
    return { confidence: 30, reason: `first name only` };
  }

  return { confidence: 0, reason: '' };
}

function scoreCompany(candidate, existing) {
  const candName = normalize(candidate.name);
  const exName   = normalize(existing.name);
  const exLegal  = normalize(existing.legalName);
  if (!candName) return { confidence: 0, reason: '' };

  const candNif = normalize(candidate.nif);
  const exNif   = normalize(existing.nif);
  if (candNif && exNif && candNif === exNif) {
    return { confidence: 100, reason: `NIF (${candNif})` };
  }

  if (exName && candName === exName) {
    return { confidence: 90, reason: `name match` };
  }
  if (exLegal && candName === exLegal) {
    return { confidence: 90, reason: `legal name match` };
  }
  // Looser: same first significant word (e.g. "NZ Promoción" vs "NZ Promoción S.L.")
  const candFirstWord = candName.split(' ')[0];
  const exFirstWord   = exName.split(' ')[0];
  if (candFirstWord && exFirstWord && candFirstWord === exFirstWord && candFirstWord.length > 2) {
    return { confidence: 40, reason: `partial name (${candFirstWord})` };
  }
  return { confidence: 0, reason: '' };
}

// ── Public API ───────────────────────────────────────────────────────────────

function findPersonMatches(candidate, threshold = 25) {
  return listPeople()
    .map(ex => ({ ...scorePerson(candidate, ex), slug: ex.slug, file: ex.file, person: ex }))
    .filter(m => m.confidence >= threshold)
    .sort((a, b) => b.confidence - a.confidence);
}

function findCompanyMatches(candidate, threshold = 25) {
  return listCompanies()
    .map(ex => ({ ...scoreCompany(candidate, ex), slug: ex.slug, file: ex.file, company: ex }))
    .filter(m => m.confidence >= threshold)
    .sort((a, b) => b.confidence - a.confidence);
}

module.exports = {
  findPersonMatches,
  findCompanyMatches,
  normalize,
  normalizeEmail,
  normalizePhone,
  parsePersonFile,
  parseCompanyFile,
  listPeople,
  listCompanies,
};
