// Shared persistence primitives for all channel agents.
// Channel-specific fillPersonMd / fillProjectMd / fillLogMd live in each
// agent (because their defaults differ — first-contact source, "Created by"
// label, etc.). Everything else that touches person.md / company.md /
// project log.md lives here so we don't duplicate it across email, kommo,
// aircall, granola, linkedin agents.

const fs   = require('fs');
const path = require('path');

const ROOT          = path.join(__dirname, '..', '..');
const PEOPLE_DIR    = path.join(ROOT, 'data', 'people');
const COMPANIES_DIR = path.join(ROOT, 'data', 'companies');
const PROJECTS_DIR  = path.join(ROOT, 'data', 'projects');

// ── Primitives ────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}

function slugify(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function readTemplate(p) {
  return fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
}

// Replace value after "- **Field:**" on a markdown bullet line. Empty value
// clears the line (no enum/placeholder leak).
function setField(text, field, value) {
  const safe = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re   = new RegExp(`(- \\*\\*${safe}:\\*\\*)[^\\n]*`, 'g');
  return text.replace(re, `$1 ${value ?? ''}`.replace(/ $/, ' '));
}

function setFields(text, fields) {
  for (const [k, v] of Object.entries(fields)) text = setField(text, k, v);
  return text;
}

// ── Templates (channel-agnostic) ─────────────────────────────────────────────

function fillCompanyMd(companyName, personSlug, personName, projectCode) {
  let text = readTemplate(path.join(COMPANIES_DIR, '_template_company.md'));
  text = text.replace('# [Company Legal Name]', `# ${companyName}`);
  text = setFields(text, {
    'Legal name':      companyName,
    'Commercial name': '',
    'NIF/CIF':         '',
    'Address':         '',
    'Country':         '',
    'Website':         '',
    'Legal owners':    '',
    'Ownership %':     '',
    'Statutes':        '',
    'ID documents':    '',
    'Other':           '',
    'Projects':        projectCode ? `/data/projects/${projectCode}` : '',
  });
  text = text.replace(
    '- [firstname_lastname.md] → role (main contact / CFO / legal owner / advisor)',
    personSlug ? `- [${personSlug}.md](/data/people/${personSlug}.md) → ${personName} (main contact)` : ''
  );
  text = text.replace(/\n- \[firstname_lastname\.md\] → role(?=\n)/, '');
  return text;
}

function fillFeedbackMd(code) {
  return readTemplate(path.join(PROJECTS_DIR, '_template_feedback.md'))
    .replace('[Project Code]', code);
}

// ── Person updates ───────────────────────────────────────────────────────────

function updatePersonFields(personSlug, updates) {
  const filePath = path.join(PEOPLE_DIR, `${personSlug}.md`);
  const text = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  fs.writeFileSync(filePath, setFields(text, updates));
}

function getActiveProjectCodes(personSlug) {
  const filePath = path.join(PEOPLE_DIR, `${personSlug}.md`);
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  // [ \t]* not \s* — see readField in entity/match.js for the same pitfall.
  const m = text.match(/^- \*\*Active projects:\*\*[ \t]*([^\n]*)$/m);
  if (!m) return [];
  return m[1].match(/\b(?:ES|PT)-\d{3}\b/g) || [];
}

// Append a project code to the comma-separated list (no duplicates). The
// `Projects` link in the Links section points at the most recent code.
function addActiveProject(personSlug, code) {
  const existing = getActiveProjectCodes(personSlug);
  if (existing.includes(code)) return;
  const merged = [...existing, code].join(', ');
  updatePersonFields(personSlug, {
    'Active projects': merged,
    'Projects':        `/data/projects/${code}`,
  });
}

// ── Logging ──────────────────────────────────────────────────────────────────

function logEntry(channel, summary, nextAction) {
  return `${today()} | ${channel} | ${summary} | ${nextAction}`;
}

function appendPersonLog(personSlug, entry) {
  const filePath = path.join(PEOPLE_DIR, `${personSlug}.md`);
  let text = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  const marker = '_(newest first — appended automatically by agents)_';
  if (text.includes(marker)) {
    text = text.replace(marker, `${marker}\n\n${entry}`);
  } else if (text.includes('## Interactions Log')) {
    text = text.replace('## Interactions Log', `## Interactions Log\n\n${entry}`);
  } else {
    text = text.trimEnd() + `\n\n## Interactions Log\n\n${entry}\n`;
  }
  fs.writeFileSync(filePath, text);
}

function appendProjectLog(code, entry) {
  const logPath = path.join(PROJECTS_DIR, code, 'log.md');
  if (!fs.existsSync(logPath)) return false;
  let text = fs.readFileSync(logPath, 'utf8').replace(/\r\n/g, '\n').trimEnd();
  text = text.replace(/\n+---\s*$/, '');
  fs.writeFileSync(logPath, text + `\n\n---\n${entry}\n`);
  return true;
}

// Decide where an interaction belongs and write it. Project trumps person:
// if the person has any active project, the log goes to that project's
// log.md; otherwise it stays in person.md as orphan-phase history.
function logInteraction(personSlug, entry) {
  if (!personSlug) return;
  const codes = getActiveProjectCodes(personSlug);
  if (codes.length > 0) {
    const code = codes.sort().reverse()[0];
    if (appendProjectLog(code, entry)) {
      console.log(`  ↻ Logged to data/projects/${code}/log.md`);
      return;
    }
  }
  appendPersonLog(personSlug, entry);
  console.log(`  ↻ Logged to data/people/${personSlug}.md`);
}

// ── Project codes ────────────────────────────────────────────────────────────

// Atomically reserves the next ES-NNN code by creating its directory.
// EEXIST means the dir already exists (claimed by another flow or by ad-hoc
// Drive renames) — we try the next number.
function reserveProjectCode() {
  const entries = fs.readdirSync(PROJECTS_DIR);
  const nums = entries
    .filter(e => /^(ES|PT)-\d{3}$/.test(e))
    .map(e => parseInt(e.split('-')[1], 10));
  let next = nums.length ? Math.max(...nums) + 1 : 1;
  while (true) {
    const code = `ES-${String(next).padStart(3, '0')}`;
    try {
      fs.mkdirSync(path.join(PROJECTS_DIR, code));
      return code;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      next++;
    }
  }
}

module.exports = {
  PEOPLE_DIR, COMPANIES_DIR, PROJECTS_DIR,
  today, slugify,
  setField, setFields, readTemplate,
  fillCompanyMd, fillFeedbackMd,
  updatePersonFields, getActiveProjectCodes, addActiveProject,
  logEntry, appendPersonLog, appendProjectLog, logInteraction,
  reserveProjectCode,
};
