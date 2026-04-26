const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const CREDS_PATH = path.join(__dirname, '../drive/credentials.json');
const TOKEN_PATH = path.join(__dirname, '../drive/token.json');

// ── Auth ──────────────────────────────────────────────────────────────────────

async function getSheets() {
  const credentials = JSON.parse(fs.readFileSync(CREDS_PATH));
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  auth.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH)));
  return google.sheets({ version: 'v4', auth });
}

// ── Column map ────────────────────────────────────────────────────────────────
// A  B             C       D        E                 F              G
// №  company_name  region  website  linkedin_profile  employee_name  employee_link
// H                I                    J     K         L
// connection_sent  connection_accepted  info  msg_sent  msg_received

const COL = {
  num:                  0,
  company_name:         1,
  region:               2,
  website:              3,
  linkedin_profile:     4,
  employee_name:        5,
  employee_link:        6,
  connection_sent:      7,
  connection_accepted:  8,
  info:                 9,
  msg_sent:             10,
  msg_received:         11,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function toBool(val) {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string')  return val.toUpperCase() === 'TRUE';
  return false;
}

function deriveStatus(row) {
  if (toBool(row[COL.msg_received]))       return 'lead';
  if (toBool(row[COL.msg_sent]))           return 'messaged';
  if (toBool(row[COL.connection_accepted])) return 'connected';
  if (row[COL.connection_sent])            return 'requested';
  return '';
}

function parseRow(row) {
  return {
    num:                  row[COL.num]                  ?? '',
    company_name:         row[COL.company_name]         ?? '',
    region:               row[COL.region]               ?? '',
    website:              row[COL.website]              ?? '',
    linkedin_profile:     row[COL.linkedin_profile]     ?? '',
    employee_name:        row[COL.employee_name]        ?? '',
    employee_link:        row[COL.employee_link]        ?? '',
    connection_sent:      row[COL.connection_sent]      ?? '',
    connection_accepted:  toBool(row[COL.connection_accepted]),
    info:                 row[COL.info]                 ?? '',
    msg_sent:             toBool(row[COL.msg_sent]),
    msg_received:         toBool(row[COL.msg_received]),
    status:               deriveStatus(row),
  };
}

// ── Public functions ──────────────────────────────────────────────────────────

async function readPipeline(spreadsheetId) {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Developers!A:L',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });

  const rows = res.data.values || [];
  const data = rows.slice(1); // skip header
  const result = [];
  for (const row of data) {
    const company  = row[COL.company_name]  ?? '';
    const employee = row[COL.employee_name] ?? '';
    if (company === '' && employee === '') break;
    result.push(parseRow(row));
  }
  return result;
}

async function getNewLeads(spreadsheetId) {
  const rows = await readPipeline(spreadsheetId);
  return rows.filter(r => r.msg_received);
}

module.exports = { readPipeline, getNewLeads };

if (require.main !== module) return;

const [,, command, ...args] = process.argv;

const commands = {
  readPipeline: async ([spreadsheetId]) => {
    if (!spreadsheetId) {
      console.error('Usage: node sheets.js readPipeline <spreadsheetId>');
      process.exit(1);
    }
    const rows = await readPipeline(spreadsheetId);
    if (!rows.length) { console.log('No rows found.'); return; }
    rows.forEach(r => {
      console.log(`[${r.num}] ${r.company_name} — ${r.employee_name}  (${r.status || 'no status'})`);
      if (r.linkedin_profile) console.log(`  ${r.linkedin_profile}`);
    });
  },
  getNewLeads: async ([spreadsheetId]) => {
    if (!spreadsheetId) {
      console.error('Usage: node sheets.js getNewLeads <spreadsheetId>');
      process.exit(1);
    }
    const leads = await getNewLeads(spreadsheetId);
    if (!leads.length) { console.log('No new leads.'); return; }
    leads.forEach(r => {
      console.log(`[${r.num}] ${r.company_name} — ${r.employee_name}`);
      console.log(`  Region: ${r.region}  |  Sent: ${r.connection_sent}`);
      if (r.info) console.log(`  Info: ${r.info}`);
    });
  },
};

if (!command || !commands[command]) {
  console.error(`Available commands: ${Object.keys(commands).join(', ')}`);
  process.exit(1);
}

commands[command](args).catch(err => {
  console.error(err.message);
  process.exit(1);
});
