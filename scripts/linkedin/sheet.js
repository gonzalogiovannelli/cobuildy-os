// Read the LinkedIn outreach sheet (Developers tab) and return parsed rows.
// The sheet ID lives in scripts/.env (LINKEDIN_SHEET_ID); auth is shared with
// scripts/drive (same Google account, same token.json).
//
// Sheet schema (Developers tab):
//   A: №                         B: company name
//   C: region                    D: website
//   E: linkedin profile          F: employee name
//   G: employee link             H: Gonzalo connection sent (date)
//   I: Connection accepted       J: Info
//   K: Msg sent                  L: Reply received   ← warm gate
//   M: Dani / N: Dani accepted   ← parallel outreach (ignored for v1)
//
// A row is "warm" when L is checked (TRUE).

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const DRIVE_DIR = path.join(__dirname, '..', 'drive');

async function getSheets() {
  const credentials = JSON.parse(fs.readFileSync(path.join(DRIVE_DIR, 'credentials.json')));
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  auth.setCredentials(JSON.parse(fs.readFileSync(path.join(DRIVE_DIR, 'token.json'))));
  return google.sheets({ version: 'v4', auth });
}

const TRUTHY = v => String(v ?? '').trim().toUpperCase() === 'TRUE';

async function readDevelopersTab(sheetId) {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Developers!A2:N1000',
  });
  const rows = res.data.values || [];
  return rows
    .filter(r => r[5] && String(r[5]).trim() !== '')
    .map(r => ({
      num:             r[0] || '',
      companyName:     (r[1]  || '').trim(),
      region:          (r[2]  || '').trim(),
      website:         (r[3]  || '').trim(),
      linkedinProfile: (r[4]  || '').trim(),
      employeeName:    (r[5]  || '').trim(),
      employeeLink:    (r[6]  || '').trim(),
      connectionSent:  (r[7]  || '').trim(),
      accepted:        TRUTHY(r[8]),
      info:            (r[9]  || '').trim(),
      msgSent:         TRUTHY(r[10]),
      replyReceived:   TRUTHY(r[11]),
    }));
}

module.exports = { readDevelopersTab };
