const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const DRIVE_DIR = path.join(__dirname, '..', 'scripts', 'drive');

async function getDrive() {
  const credentials = JSON.parse(fs.readFileSync(path.join(DRIVE_DIR, 'credentials.json')));
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  auth.setCredentials(JSON.parse(fs.readFileSync(path.join(DRIVE_DIR, 'token.json'))));
  return google.drive({ version: 'v3', auth });
}

async function renameFile(drive, fileId, newName) {
  const res = await drive.files.update({ fileId, resource: { name: newName }, fields: 'id,name' });
  return res.data;
}

async function downloadFile(drive, fileId, destPath) {
  const dest = fs.createWriteStream(destPath);
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
  await new Promise((resolve, reject) => res.data.on('end', resolve).on('error', reject).pipe(dest));
}

const RENAMES = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2])) : [];

(async () => {
  const drive = await getDrive();
  for (const { id, name } of RENAMES) {
    process.stdout.write(`Renaming to "${name}"... `);
    await renameFile(drive, id, name);
    console.log('done');
  }
})().catch(e => { console.error(e.message); process.exit(1); });
