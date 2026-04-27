const path = require('path');
const fs = require('fs');
const readline = require('readline');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const _sdk = require('@anthropic-ai/sdk');
const Anthropic = _sdk.default ?? _sdk;

const { listEmails, readEmail } = require('./email.js');
const { createProjectStructure } = require('../drive/drive.js');
const { findPersonMatches, findCompanyMatches } = require('../entity/match.js');

// ── Constants ────────────────────────────────────────────────────────────────

const KEYWORDS = [
  'proyecto', 'inversión', 'financiación', 'equity',
  'ticket', 'urbanización', 'promoción',
];

const BODY_LIMIT    = 3000;
const KNOWHOW_ROOT  = path.join(__dirname, '../../');
const PROJECTS_DIR  = path.join(KNOWHOW_ROOT, 'data/projects');
const PEOPLE_DIR    = path.join(KNOWHOW_ROOT, 'data/people');
const COMPANIES_DIR = path.join(KNOWHOW_ROOT, 'data/companies');

// ── Readline helper ───────────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise(resolve => rl.question(question, ans => resolve(ans.trim().toLowerCase())));
}

// ── Knowhow & system prompt ───────────────────────────────────────────────────

function loadKnowhow() {
  const files = ['knowhow/entity-matching.md', 'knowhow/email-agent.md'];
  return files.map(f => {
    try {
      return `=== ${f} ===\n${fs.readFileSync(path.join(KNOWHOW_ROOT, f), 'utf8')}`;
    } catch {
      return `=== ${f} ===\n(file not found — add this file to define the rules)`;
    }
  }).join('\n\n');
}

const SYSTEM_PROMPT = `${loadKnowhow()}

Based on the rules above, analyze the email provided by the user and return ONLY a valid JSON object with exactly this structure:
{
  "isProjectRelated": boolean,
  "sender": { "name": string, "email": string, "company": string | null },
  "projectInfo": { "location": string, "ticket": string, "type": string } | null,
  "suggestedAction": string,
  "verdict_needed": boolean
}
The "company" field is the legal/commercial name of the sender's company if it appears in the email signature, body, or domain — otherwise null.
Do not include any explanation, markdown, or code fences — only the JSON object.`;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Email helpers ─────────────────────────────────────────────────────────────

function isRelevant(email) {
  if (email.hasAttachment) return true;
  const haystack = `${email.subject} ${email.from}`.toLowerCase();
  return KEYWORDS.some(kw => haystack.includes(kw));
}

function stripHtml(str) {
  return str.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── Anthropic analysis ────────────────────────────────────────────────────────

async function analyzeEmail(email) {
  let full = null;
  try {
    full = await readEmail('INBOX', email.uid);
  } catch {
    // fall back to header-only if full fetch fails
  }

  const body           = full ? stripHtml(full.body).slice(0, BODY_LIMIT) : '';
  const attachmentList = full?.attachments.map(a => a.filename).join(', ') ?? '';

  const lines = [
    `Subject: ${email.subject}`,
    `From:    ${email.from}`,
    `Date:    ${email.date}`,
  ];
  if (attachmentList) lines.push(`Attachments: ${attachmentList}`);
  if (body)           lines.push(`\nBody:\n${body}`);
  if (!full)          lines.push('(body unavailable — header only)');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: lines.join('\n') }],
  });

  const raw  = response.content.find(b => b.type === 'text')?.text ?? '{}';
  const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(json);
}

// ── Project code ──────────────────────────────────────────────────────────────

// Reserves the next available project code by atomically creating its
// directory. mkdir without `recursive` throws EEXIST if the dir is already
// taken — we catch and try the next number. This prevents two flows from
// claiming the same code, and also forces anyone using a code outside the
// agent (e.g. ad-hoc Drive renames) to reserve it first by creating the dir.
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

// ── Local project scaffolding ─────────────────────────────────────────────────

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

// Replace the value after "- **Field:**" on a markdown bullet line.
// Empty/null/undefined values clear the line (no enum/placeholder leaks through).
function setField(text, field, value) {
  const safe = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re   = new RegExp(`(- \\*\\*${safe}:\\*\\*)[^\\n]*`, 'g');
  return text.replace(re, `$1 ${value ?? ''}`.replace(/ $/, ' '));
}

function setFields(text, fields) {
  for (const [k, v] of Object.entries(fields)) text = setField(text, k, v);
  return text;
}

function fillPersonMd(analysis, companySlug, projectCode, emailSubject) {
  const name  = analysis.sender?.name  || 'Unknown';
  const email = analysis.sender?.email || '';
  const date  = today();

  let text = fs.readFileSync(path.join(PEOPLE_DIR, '_template_person.md'), 'utf8').replace(/\r\n/g, '\n');

  // Title
  text = text.replace('# [Full Name]', `# ${name}`);

  // Generic fields — every field listed clears placeholders and fills if value present
  text = setFields(text, {
    'Email':              email,
    'Type':               'promoter',
    'Investor ID':        '',
    'Channel':            'email',
    'Language':           '',
    'First contact date': date,
    'Current stage':      'analysis',
    'Last updated':       date,
    'Active projects':    projectCode || '',
    'Last interaction':   emailSubject ? `${date} | Email | ${emailSubject}` : '',
    'Projects':           projectCode ? `/data/projects/${projectCode}` : '',
  });

  // Company appears in two sections with different formats — handle each explicitly.
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

function fillCompanyMd(analysis, personSlug, projectCode) {
  const companyName = analysis.sender?.company || 'Unknown';
  const personName  = analysis.sender?.name    || 'Unknown';

  let text = fs.readFileSync(path.join(COMPANIES_DIR, '_template_company.md'), 'utf8').replace(/\r\n/g, '\n');

  // Title
  text = text.replace('# [Company Legal Name]', `# ${companyName}`);

  // Generic fields
  text = setFields(text, {
    'Legal name':      companyName,
    'Commercial name': '',
    'NIF/CIF':         '',
    'Address':         '',
    'Country':         '',
    'Website':         '',
    'Legal owners':    '',
    'Ownership %':     '',
    'Type':            '',
    'Parent company':  '',
    'Statutes':        '',
    'ID documents':    '',
    'Other':           '',
    'Projects':        projectCode ? `/data/projects/${projectCode}` : '',
  });

  // Associated People — replace example lines with one filled entry.
  text = text.replace(
    '- [firstname_lastname.md] → role (main contact / CFO / legal owner / advisor)',
    personSlug ? `- [${personSlug}.md](/data/people/${personSlug}.md) → ${personName} (main contact)` : ''
  );
  text = text.replace(/\n- \[firstname_lastname\.md\] → role(?=\n)/, '');

  return text;
}

function fillProjectMd(code, analysis, personSlug, companySlug) {
  const location   = analysis.projectInfo?.location || '';
  const ticket     = analysis.projectInfo?.ticket   || '';
  const type       = analysis.projectInfo?.type     || '';
  const senderName = analysis.sender?.name          || '';
  const date       = today();

  let text = fs.readFileSync(path.join(PROJECTS_DIR, '_template_project.md'), 'utf8').replace(/\r\n/g, '\n');

  // Title
  text = text.replace(
    '# [Project Code] - [Location]',
    location ? `# ${code} - ${location}` : `# ${code}`
  );

  // Generic fields
  text = setFields(text, {
    'Code':                       code,
    'Stage':                      'analysis',
    'Location':                   location,
    'Type':                       type,
    'Total area (m²)':            '',
    'Ticket (€)':                 ticket,
    'Financing instrument':       '',
    'Timeline':                   '',
    'Skin in the game (min 10%)': '',
    'Land secured':               '',
    'Ticket above €500K':         '',
    'Commercial entity':          '',
    'Legal entity':               '',
    'Special purpose vehicle':    '',
    'SPV legal name':             '',
    'Promoter':                   personSlug ? `/data/people/${personSlug}.md` : '',
    'Company':                    companySlug ? `/data/companies/${companySlug}.md` : '',
    'Drive folder ID':            '',
    'Drive folder link':          '',
    'Google Sheet':               '',
    'Created':                    date,
    'First document received':    date,
    'Created by':                 'Email Agent',
  });

  // Status Summary
  text = text.replace(
    '_(brief description of where we are today)_',
    `Lead received via email from ${senderName}. Pending review.`
  );

  return text;
}

function fillLogMd(code, subject) {
  const entry = `${today()} | Email | ${subject} | Project created from email`;
  return fs.readFileSync(path.join(PROJECTS_DIR, '_template_log.md'), 'utf8')
    .replace('[Project Code]', code)
    .replace('YYYY-MM-DD | [LinkedIn / WhatsApp / Email / Call / Meet] | [Brief description of what happened] | [What needs to happen next]', entry);
}

function fillFeedbackMd(code) {
  return fs.readFileSync(path.join(PROJECTS_DIR, '_template_feedback.md'), 'utf8')
    .replace('[Project Code]', code);
}

// Apply BRD entity-matching policy (section 5.2): ≥90% auto-link, 25–89% ask,
// <25% create new. Returns { slug, existing } where existing is non-null when
// we're reusing an existing person record.
async function resolvePerson(analysis) {
  const candidate = {
    name:    analysis.sender?.name,
    email:   analysis.sender?.email,
    phone:   null,
    company: analysis.sender?.company,
  };
  const matches = findPersonMatches(candidate);
  const top = matches[0];

  if (top && top.confidence >= 90) {
    console.log(`  i Matched existing person: ${top.slug} (${top.confidence}% — ${top.reason})`);
    return { slug: top.slug, existing: top };
  }
  if (top && top.confidence >= 25) {
    console.log(`  ? Possible match: ${top.slug} (${top.confidence}% — ${top.reason})`);
    console.log(`      Existing: ${top.person.name} <${top.person.email || '—'}>`);
    console.log(`      Incoming: ${candidate.name} <${candidate.email || '—'}>`);
    const ans = await ask('  Use existing? (yes / no — create new): ');
    if (ans === 'yes' || ans === 'y') return { slug: top.slug, existing: top };
  }
  return { slug: slugify(candidate.name), existing: null };
}

async function resolveCompany(analysis) {
  const name = analysis.sender?.company;
  if (!name) return { slug: null, existing: null };
  const matches = findCompanyMatches({ name });
  const top = matches[0];

  if (top && top.confidence >= 90) {
    console.log(`  i Matched existing company: ${top.slug} (${top.confidence}% — ${top.reason})`);
    return { slug: top.slug, existing: top };
  }
  if (top && top.confidence >= 25) {
    console.log(`  ? Possible company match: ${top.slug} (${top.confidence}% — ${top.reason})`);
    console.log(`      Existing: ${top.company.name}`);
    console.log(`      Incoming: ${name}`);
    const ans = await ask('  Use existing? (yes / no — create new): ');
    if (ans === 'yes' || ans === 'y') return { slug: top.slug, existing: top };
  }
  return { slug: slugify(name), existing: null };
}

async function createLocalProject(code, analysis, emailSubject, personSlug, personExists, companySlug, companyExists) {
  // Person file — only write if we're creating a new one. Existing matches
  // are reused as-is (we don't overwrite their data).
  if (personSlug && !personExists) {
    fs.writeFileSync(
      path.join(PEOPLE_DIR, `${personSlug}.md`),
      fillPersonMd(analysis, companySlug, code, emailSubject),
    );
    console.log(`  ✓ Created data/people/${personSlug}.md`);
  }

  // Company file — same logic.
  if (companySlug && !companyExists) {
    fs.writeFileSync(
      path.join(COMPANIES_DIR, `${companySlug}.md`),
      fillCompanyMd(analysis, personSlug, code),
    );
    console.log(`  ✓ Created data/companies/${companySlug}.md`);
  }

  // Project files (directory was already reserved via reserveProjectCode)
  const projectDir = path.join(PROJECTS_DIR, code);
  fs.writeFileSync(path.join(projectDir, 'project.md'),  fillProjectMd(code, analysis, personSlug, companySlug));
  fs.writeFileSync(path.join(projectDir, 'log.md'),      fillLogMd(code, emailSubject));
  fs.writeFileSync(path.join(projectDir, 'feedback.md'), fillFeedbackMd(code));

  console.log(`  ✓ Created data/projects/${code}/  (project.md · log.md · feedback.md)`);
}

// ── Print analysis ────────────────────────────────────────────────────────────

function printAnalysis(email, result) {
  const SEP = '─'.repeat(60);
  console.log(`\n${SEP}`);
  console.log(`[${email.uid}] ${email.subject}`);
  console.log(SEP);
  console.log(`Sender:    ${result.sender?.name || ''} <${result.sender?.email || ''}>`);
  if (result.projectInfo) {
    console.log(`Location:  ${result.projectInfo.location}`);
    console.log(`Ticket:    ${result.projectInfo.ticket}`);
    console.log(`Type:      ${result.projectInfo.type}`);
  }
  console.log(`Action:    ${result.suggestedAction}`);
  console.log(SEP);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set in scripts/.env');
    process.exit(1);
  }

  console.log('Fetching last 20 emails from INBOX...');
  const emails   = await listEmails('INBOX', 20);
  const relevant = emails.filter(isRelevant);

  console.log(`${emails.length} fetched, ${relevant.length} flagged for analysis.\n`);

  if (!relevant.length) {
    console.log('No relevant emails found.');
    rl.close();
    return;
  }

  for (const email of relevant) {
    process.stdout.write(`Analyzing [${email.uid}] ${email.subject} … `);
    let result;
    try {
      result = await analyzeEmail(email);
      console.log('ok');
    } catch (err) {
      console.log('error');
      console.error(`  ${err.message}`);
      continue;
    }

    if (!result.isProjectRelated) {
      console.log('  → Not project-related, skipping.\n');
      continue;
    }

    printAnalysis(email, result);

    const verdict = await ask('Verdict for this project? (viable / discarded / pending / skip): ');

    if (verdict === 'skip') {
      console.log('  → Skipped.\n');
      continue;
    }

    if (verdict === 'discarded' || verdict === 'pending') {
      console.log(`  → Logged as ${verdict}.\n`);
      continue;
    }

    if (verdict === 'viable') {
      // Resolve entities BEFORE reserving the project code, so that any
      // user-prompts for ambiguous matches happen up-front and we don't
      // leave an orphan reserved directory if the user bails.
      const { slug: personSlug,  existing: personExisting  } = await resolvePerson(result);
      const { slug: companySlug, existing: companyExisting } = await resolveCompany(result);

      const code     = reserveProjectCode();
      const location = result.projectInfo?.location || 'Unknown';
      const promoter = result.sender?.name          || 'Unknown';

      console.log(`\n  Assigning code: ${code}`);

      // Local project folder
      try {
        await createLocalProject(code, result, email.subject, personSlug, personExisting, companySlug, companyExisting);
      } catch (err) {
        console.error(`  ✗ Local folder error: ${err.message}`);
      }

      // Google Drive folder
      try {
        await createProjectStructure(code, location, promoter);
        console.log(`  ✓ Drive folder created for ${code}`);
      } catch (err) {
        console.error(`  ✗ Drive folder error: ${err.message}`);
      }

      console.log('');
    } else {
      console.log('  → Unrecognised input, skipping.\n');
    }
  }

  rl.close();
}

main().catch(err => {
  console.error(err.message);
  rl.close();
  process.exit(1);
});
