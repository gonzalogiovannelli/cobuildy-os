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

// Parse existing log entries from a body string. Supports both legacy
// (tight stacking, no `---` separators between entries) and new
// (entries separated by `\n---\n` with optional rich body per entry).
function parseExistingEntries(body) {
  const lines = body.split('\n');
  const entries = [];
  let current = null;
  for (const line of lines) {
    if (line.trim() === '---') {
      if (current !== null) entries.push(current.trimEnd());
      current = null;
      continue;
    }
    if (/^\d{4}-\d{2}-\d{2} \|/.test(line)) {
      if (current !== null) entries.push(current.trimEnd());
      current = line;
    } else if (current !== null) {
      current += '\n' + line;
    }
    // else: blank/unrecognised line outside any entry — skip
  }
  if (current !== null) entries.push(current.trimEnd());
  return entries.filter(e => e.trim());
}

function firstLine(entry) {
  return entry.split('\n', 1)[0];
}

// Dedup key, in priority order:
//   1. Explicit `<!-- src:ID -->` markers in the header line. Most
//      precise — used for events that have a stable upstream ID
//      (aircall:CALL_ID, kn:NOTE_ID, mid:MESSAGE_ID hash, etc.).
//   2. Email and Meet → (date, channel-tag). Their summaries are
//      non-deterministic (Email AI summary) or rewritten on upgrade
//      (Meet short → full body), so we can't rely on text identity.
//   3. Other channels (Kommo, LinkedIn, raw Call without marker) →
//      first 80 chars of the header line. Deterministic content stays
//      unique across re-runs.
function entryKey(entry) {
  const line = firstLine(entry);
  const markerM = line.match(/<!--\s*([a-z]+):([A-Za-z0-9_-]+)\s*-->/);
  if (markerM) return `${markerM[1]}:${markerM[2]}`;
  const evt = line.match(/^(\d{4}-\d{2}-\d{2}) \| (Email[^|]*|Meet) \|/);
  if (evt) return `${evt[1]} | ${evt[2].trim()}`;
  return line.slice(0, 80);
}

// Insert many entries at once, sorted newest-first by their leading
// YYYY-MM-DD date. Each entry is either a single header line or a
// header line followed by a multi-line body (e.g. full Granola summary
// for Meet entries). Entries are written separated by `\n---\n`.
//
// opts.replace: when true, new entries overwrite existing ones with
// the same dedup key. Default false (existing wins — needed for email
// backfill idempotency where Claude summaries are non-deterministic).
function rebuildPersonLog(personSlug, newEntries, opts = {}) {
  const replace = !!opts.replace;
  const logPath = ensurePersonLog(personSlug);
  const text = fs.readFileSync(logPath, 'utf8').replace(/\r\n/g, '\n');

  const marker = '_(newest first — appended automatically by agents';
  const markerIdx = text.indexOf(marker);
  let header;
  let body;
  if (markerIdx < 0) {
    header = `# ${personSlug} — Interactions Log\n_(newest first — appended automatically by agents. Format: YYYY-MM-DD | Channel | Summary | Next action)_\n`;
    body = '';
  } else {
    const eol = text.indexOf('\n', markerIdx);
    header = text.slice(0, eol + 1);
    body   = text.slice(eol + 1);
  }

  const existingEntries = parseExistingEntries(body);

  let all;
  if (replace) {
    // Drop any existing entries whose key matches a new entry's key.
    const newKeys = new Set(newEntries.map(entryKey));
    const surviving = existingEntries.filter(e => !newKeys.has(entryKey(e)));
    all = [...surviving, ...newEntries];
  } else {
    all = [...existingEntries, ...newEntries];
  }

  const seen = new Set();
  const dedup = [];
  for (const e of all) {
    const key = entryKey(e);
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push(e);
  }
  // Sort newest first by date in the header line.
  dedup.sort((a, b) => firstLine(b).localeCompare(firstLine(a)));

  const out = header + '\n' + dedup.join('\n\n---\n\n') + '\n';
  fs.writeFileSync(logPath, out);
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
