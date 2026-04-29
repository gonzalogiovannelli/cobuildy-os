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

// Build a person.md title that's still recognisable when the name field
// only has a first name (e.g. "Javier" from a Marquiz form). Falls back
// to company → email → phone for the disambiguator.
function buildPersonTitle(name, { company, email, phone } = {}) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return 'Unknown';
  if (trimmed.split(/\s+/).length >= 2) return trimmed;
  if (company) return `${trimmed} (${company})`;
  if (email)   return `${trimmed} (${email})`;
  if (phone)   return `${trimmed} (${phone})`;
  return trimmed;
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

// Append an entry to the per-person sidecar log file. Creates the log
// file from template if it doesn't exist yet (lazy initialisation).
// Newest entry stays at the top so the file reads reverse-chronological.
const PEOPLE_LOGS_DIR = path.join(PEOPLE_DIR, 'logs');

function ensurePersonLog(personSlug) {
  const logPath = path.join(PEOPLE_LOGS_DIR, `${personSlug}.md`);
  if (fs.existsSync(logPath)) return logPath;
  if (!fs.existsSync(PEOPLE_LOGS_DIR)) fs.mkdirSync(PEOPLE_LOGS_DIR, { recursive: true });
  const tplPath = path.join(PEOPLE_LOGS_DIR, '_template_person_log.md');
  let body = '';
  if (fs.existsSync(tplPath)) {
    body = readTemplate(tplPath).replace('[Slug]', personSlug);
  } else {
    body = `# ${personSlug} — Interactions Log\n_(newest first — appended automatically by agents)_\n`;
  }
  fs.writeFileSync(logPath, body);
  return logPath;
}

function appendPersonLog(personSlug, entry) {
  const logPath = ensurePersonLog(personSlug);
  let text = fs.readFileSync(logPath, 'utf8').replace(/\r\n/g, '\n');
  const marker = '_(newest first — appended automatically by agents';
  const idx = text.indexOf(marker);
  if (idx >= 0) {
    // Insert right after the marker line.
    const eol = text.indexOf('\n', idx);
    const before = text.slice(0, eol + 1);
    const after  = text.slice(eol + 1);
    text = `${before}\n${entry}\n${after}`;
  } else {
    text = text.trimEnd() + `\n\n${entry}\n`;
  }
  fs.writeFileSync(logPath, text);
}

// Insert many entries at once, sorted newest-first by their leading
// YYYY-MM-DD date. Used by backfill scripts.
function rebuildPersonLog(personSlug, entries) {
  const logPath = ensurePersonLog(personSlug);
  const text = fs.readFileSync(logPath, 'utf8').replace(/\r\n/g, '\n');

  // Header = everything up to and including the marker comment line.
  const marker = '_(newest first — appended automatically by agents';
  const markerIdx = text.indexOf(marker);
  if (markerIdx < 0) {
    // Malformed — just write everything fresh.
    const sorted = [...entries].sort().reverse();
    fs.writeFileSync(logPath,
      `# ${personSlug} — Interactions Log\n_(newest first — appended automatically by agents. Format: YYYY-MM-DD | Channel | Summary | Next action)_\n\n${sorted.join('\n')}\n`);
    return;
  }
  const eol = text.indexOf('\n', markerIdx);
  const header = text.slice(0, eol + 1);
  const rest   = text.slice(eol + 1);

  // Existing entries (parse lines starting with a date)
  const lineRe = /^\d{4}-\d{2}-\d{2} \|/;
  const existingEntries = rest.split('\n').filter(l => lineRe.test(l));

  const all = [...existingEntries, ...entries];
  // Dedup key:
  //   - Email entries (where the AI summary is non-deterministic across
  //     runs) collapse on (date, channel-tag) — there's at most one
  //     summary per email-direction-per-day in practice.
  //   - Other channels (Kommo, LinkedIn, Call, Meet) where the text is
  //     deterministic fall back to first 80 chars so legit multiple
  //     same-day notes are preserved.
  function entryKey(line) {
    const emailMatch = line.match(/^(\d{4}-\d{2}-\d{2}) \| (Email[^|]*) \|/);
    if (emailMatch) return `${emailMatch[1]} | ${emailMatch[2].trim()}`;
    return line.slice(0, 80);
  }
  const seen = new Set();
  const dedup = [];
  for (const e of all) {
    const key = entryKey(e);
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push(e);
  }
  // Sort newest first by the leading date string (lexicographic == chronological for ISO).
  dedup.sort((a, b) => b.localeCompare(a));

  fs.writeFileSync(logPath, `${header}\n${dedup.join('\n')}\n`);
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
  PEOPLE_DIR, COMPANIES_DIR, PROJECTS_DIR, PEOPLE_LOGS_DIR,
  today, slugify,
  setField, setFields, readTemplate, buildPersonTitle,
  fillCompanyMd, fillFeedbackMd,
  updatePersonFields, getActiveProjectCodes, addActiveProject,
  logEntry, ensurePersonLog, appendPersonLog, rebuildPersonLog,
  appendProjectLog, logInteraction,
  reserveProjectCode,
};
