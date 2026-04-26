const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const _sdk = require('@anthropic-ai/sdk');
const Anthropic = _sdk.default ?? _sdk;

const { listEmails } = require('./email.js');

const KEYWORDS = [
  'proyecto', 'inversión', 'financiación', 'equity',
  'ticket', 'urbanización', 'promoción',
];

const KNOWHOW_ROOT = path.join(__dirname, '../../');

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

function isRelevant(email) {
  if (email.hasAttachment) return true;
  const haystack = `${email.subject} ${email.from}`.toLowerCase();
  return KEYWORDS.some(kw => haystack.includes(kw));
}

// Build once — static content, gets cached by Anthropic on the first API call
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

async function analyzeEmail(email) {
  const content = [
    `Subject: ${email.subject}`,
    `From:    ${email.from}`,
    `Date:    ${email.date}`,
    `Has attachment: ${email.hasAttachment ? 'yes' : 'no'}`,
  ].join('\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' }, // knowhow is stable — cache it
      },
    ],
    messages: [{ role: 'user', content }],
  });

  const raw = response.content.find(b => b.type === 'text')?.text ?? '{}';
  // Strip accidental code fences in case the model adds them
  const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(json);
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set in scripts/.env');
    process.exit(1);
  }

  console.log('Fetching last 20 emails from INBOX...');
  const emails = await listEmails('INBOX', 20);
  const relevant = emails.filter(isRelevant);

  console.log(`${emails.length} fetched, ${relevant.length} flagged for analysis.\n`);

  if (!relevant.length) {
    console.log('No relevant emails found.');
    return;
  }

  for (const email of relevant) {
    process.stdout.write(`[${email.uid}] ${email.subject} … `);
    try {
      const result = await analyzeEmail(email);
      console.log('ok');
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.log('error');
      console.error(`  ${err.message}`);
    }
    console.log('');
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
