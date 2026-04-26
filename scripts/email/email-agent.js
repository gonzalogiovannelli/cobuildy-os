const path = require('path');
const fs = require('fs');
const readline = require('readline');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const _sdk = require('@anthropic-ai/sdk');
const Anthropic = _sdk.default ?? _sdk;

const { listEmails, readEmail } = require('./email.js');
const { createProjectStructure } = require('../drive/drive.js');

// ── Constants ────────────────────────────────────────────────────────────────

const KEYWORDS = [
  'proyecto', 'inversión', 'financiación', 'equity',
  'ticket', 'urbanización', 'promoción',
];

const BODY_LIMIT    = 3000;
const KNOWHOW_ROOT  = path.join(__dirname, '../../');
const PROJECTS_DIR  = path.join(KNOWHOW_ROOT, 'data/projects');

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
  "sender": { "name": string, "email": string },
  "projectInfo": { "location": string, "ticket": string, "type": string } | null,
  "suggestedAction": string,
  "verdict_needed": boolean
}
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

function nextProjectCode() {
  const entries = fs.readdirSync(PROJECTS_DIR);
  const nums = entries
    .filter(e => /^(ES|PT)-\d{3}$/.test(e))
    .map(e => parseInt(e.split('-')[1], 10));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `ES-${String(next).padStart(3, '0')}`;
}

// ── Local project scaffolding ─────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fillProjectMd(code, analysis) {
  const location   = analysis.projectInfo?.location || '';
  const ticket     = analysis.projectInfo?.ticket   || '';
  const type       = analysis.projectInfo?.type     || '';
  const senderName = analysis.sender?.name          || '';
  const date       = today();

  return fs.readFileSync(path.join(PROJECTS_DIR, '_template_project.md'), 'utf8')
    .replace('[Project Code]', code)
    .replace('[Location]',     location || 'TBD')
    .replace('**Code:** ES-00X',                            `**Code:** ${code}`)
    .replace('prospecting / active / on hold / closed',     'prospecting')
    .replace('**Location:** \n',                            `**Location:** ${location}\n`)
    .replace('residential / commercial / mixed',            type || 'residential / commercial / mixed')
    .replace('**Ticket (€):** \n',                         `**Ticket (€):** ${ticket}\n`)
    .replace('**Created:** YYYY-MM-DD',                     `**Created:** ${date}`)
    .replace('**First document received:** \n',             `**First document received:** ${date}\n`)
    .replace('**Created by:** \n',                          `**Created by:** Email Agent\n`)
    .replace('_(brief description of where we are today)_', `Lead received via email from ${senderName}. Pending review.`);
}

function fillLogMd(code, subject) {
  const entry = `${today()} | Email | ${subject} | Review and respond to sender`;
  return fs.readFileSync(path.join(PROJECTS_DIR, '_template_log.md'), 'utf8')
    .replace('[Project Code]', code)
    .replace('YYYY-MM-DD | [LinkedIn / WhatsApp / Email / Call / Meet] | [Brief description of what happened] | [What needs to happen next]', entry);
}

function fillFeedbackMd(code) {
  return fs.readFileSync(path.join(PROJECTS_DIR, '_template_feedback.md'), 'utf8')
    .replace('[Project Code]', code);
}

async function createLocalProject(code, analysis, emailSubject) {
  const projectDir = path.join(PROJECTS_DIR, code);
  fs.mkdirSync(projectDir);

  fs.writeFileSync(path.join(projectDir, 'project.md'),  fillProjectMd(code, analysis));
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
      const code     = nextProjectCode();
      const location = result.projectInfo?.location || 'Unknown';
      const promoter = result.sender?.name          || 'Unknown';

      console.log(`\n  Assigning code: ${code}`);

      // Local project folder
      try {
        await createLocalProject(code, result, email.subject);
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
