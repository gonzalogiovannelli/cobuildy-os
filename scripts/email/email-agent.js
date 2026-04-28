const path = require('path');
const fs = require('fs');
const readline = require('readline');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const _sdk = require('@anthropic-ai/sdk');
const Anthropic = _sdk.default ?? _sdk;

const { listEmails, readEmail } = require('./email.js');
const { createProjectStructure } = require('../drive/drive.js');
const { findPersonMatches, findCompanyMatches } = require('../entity/match.js');
const {
  PEOPLE_DIR, COMPANIES_DIR, PROJECTS_DIR,
  today, slugify, setFields, readTemplate,
  fillCompanyMd, fillFeedbackMd,
  updatePersonFields, addActiveProject,
  logEntry, logInteraction,
  reserveProjectCode,
} = require('../entity/persist.js');

// ── Constants ────────────────────────────────────────────────────────────────

const KEYWORDS = [
  'proyecto', 'inversión', 'financiación', 'equity',
  'ticket', 'urbanización', 'promoción',
];

const BODY_LIMIT    = 3000;
const KNOWHOW_ROOT  = path.join(__dirname, '../../');

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

// ── Local project scaffolding ─────────────────────────────────────────────────

function fillPersonMd(analysis, companySlug, projectCode, emailSubject, firstContactDate) {
  const name  = analysis.sender?.name  || 'Unknown';
  const email = analysis.sender?.email || '';
  const date  = today();
  const firstSeen = firstContactDate || date;

  let text = fs.readFileSync(path.join(PEOPLE_DIR, '_template_person.md'), 'utf8').replace(/\r\n/g, '\n');

  // Title
  text = text.replace('# [Full Name]', `# ${name}`);

  // Generic fields — every field listed clears placeholders and fills if value present
  text = setFields(text, {
    'Email':              email,
    'Role':               'promoter',
    'Investor ID':        '',
    'Channel':            'email',
    'Language':           '',
    'First contact date': firstSeen,
    'Current stage':      'prospecting',
    'Last updated':       date,
    'Active projects':    projectCode || '',
    'Last email':         firstSeen,
    'Last call':          '',
    'Last meet':          '',
    'Last LinkedIn':      '',
    'Last Kommo':         '',
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
    'Asset type':                 type,
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

// Apply entity-matching policy (see knowhow/entity-matching.md):
// ≥90% auto-link, 25–89% ask, <25% create new. Returns { slug, existing }
// where existing is non-null when we're reusing an existing record.
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
      fillCompanyMd(analysis.sender?.company || 'Unknown', personSlug, analysis.sender?.name || 'Unknown', code),
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

    // Email date (header) — the actual touchpoint, not when the agent ran.
    const emailDate = email.date ? new Date(email.date).toISOString().slice(0, 10) : today();

    // Non-project email: only touch if the sender already exists in the
    // system, just to refresh their Last email date. Otherwise skip — we
    // don't create new persons from newsletters / OOO / random senders.
    if (!result.isProjectRelated) {
      const matches = findPersonMatches({
        name:    result.sender?.name,
        email:   result.sender?.email,
        company: result.sender?.company,
      });
      const top = matches[0];
      if (top && top.confidence >= 90) {
        updatePersonFields(top.slug, { 'Last email': emailDate, 'Last updated': today() });
        console.log(`  → Non-project email from existing contact ${top.slug}; Last email refreshed.\n`);
      } else {
        console.log('  → Not project-related, skipping.\n');
      }
      continue;
    }

    printAnalysis(email, result);

    // Resolve and persist person/company FIRST, regardless of verdict.
    // Sender is a real lead even when the 3 criteria aren't there yet.
    const { slug: personSlug,  existing: personExisting  } = await resolvePerson(result);
    const { slug: companySlug, existing: companyExisting } = await resolveCompany(result);

    if (personSlug && !personExisting) {
      fs.writeFileSync(
        path.join(PEOPLE_DIR, `${personSlug}.md`),
        fillPersonMd(result, companySlug, null, email.subject, emailDate),
      );
      console.log(`  ✓ Created data/people/${personSlug}.md`);
    } else if (personSlug && personExisting) {
      updatePersonFields(personSlug, {
        'Last email':   emailDate,
        'Last updated': today(),
      });
      console.log(`  ↻ Updated activity on data/people/${personSlug}.md`);
    }

    if (companySlug && !companyExisting) {
      fs.writeFileSync(
        path.join(COMPANIES_DIR, `${companySlug}.md`),
        fillCompanyMd(result.sender?.company || 'Unknown', personSlug, result.sender?.name || 'Unknown', null),
      );
      console.log(`  ✓ Created data/companies/${companySlug}.md`);
    }

    // 3-criteria gate. If location, ticket, or asset type are missing from
    // the analysis, the lead isn't ripe for a verdict yet — log the touch
    // and move on. The lead stays in prospecting until criteria firm up.
    const p = result.projectInfo;
    const hasCriteria = p && p.location && p.ticket && p.type;
    if (!hasCriteria) {
      logInteraction(personSlug, logEntry('Email', email.subject, 'criteria not yet met'));
      console.log('  → Criteria incomplete (need location + ticket + asset type). Logged, no verdict.\n');
      continue;
    }

    const verdict = await ask('Verdict for this project? (viable / discarded / pending / skip): ');

    if (verdict === 'skip') {
      console.log('  → Skipped.\n');
      continue;
    }
    if (!['viable', 'discarded', 'pending'].includes(verdict)) {
      console.log('  → Unrecognised input, skipping.\n');
      continue;
    }

    if (verdict === 'discarded' || verdict === 'pending') {
      const note = verdict === 'discarded' ? 'discarded — no project created' : 'pending review';
      logInteraction(personSlug, logEntry('Email', email.subject, note));
      console.log(`  → Logged as ${verdict}.\n`);
      continue;
    }

    // verdict === 'viable' from here on.
    const code     = reserveProjectCode();
    const location = result.projectInfo?.location || 'Unknown';
    const promoter = result.sender?.name          || 'Unknown';

    console.log(`\n  Assigning code: ${code}`);

    // Project files (person/company already handled above — pass `existing`
    // flags as truthy so createLocalProject doesn't try to recreate them).
    try {
      await createLocalProject(code, result, email.subject, personSlug, true, companySlug, true);
    } catch (err) {
      console.error(`  ✗ Local folder error: ${err.message}`);
    }

    // Backfill the project link into the person.md (we didn't know it yet
    // when the person was first created/updated above). addActiveProject
    // appends to existing list (handles multi-project people). The "project
    // created" log entry is already in the project's log.md via fillLogMd,
    // so we don't duplicate it on the person. Person stage moves to active.
    if (personSlug) {
      addActiveProject(personSlug, code);
      updatePersonFields(personSlug, { 'Current stage': 'active' });
    }

    // Google Drive folder
    try {
      await createProjectStructure(code, location, promoter);
      console.log(`  ✓ Drive folder created for ${code}`);
    } catch (err) {
      console.error(`  ✗ Drive folder error: ${err.message}`);
    }

    console.log('');
  }

  rl.close();
}

main().catch(err => {
  console.error(err.message);
  rl.close();
  process.exit(1);
});
