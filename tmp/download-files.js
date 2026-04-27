const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const files = [
  { id: '142YJxfXcjmvK3CV7x-9JiTzqZAQdT4FY', name: '2023-CuentasAnuales-RRMM.pdf' },
  { id: '1S1ctknIqDJEMWqqv-GgGAADkjEdZf_be', name: 'precioscompra.pdf' },
  { id: '16A5Q4NwE2EEESwpI3u_U-OEQBW5cU4yX', name: 'PyG-INV-POLANDRIUS.pdf' },
  { id: '1ocCo3b2KJBLS3Y9jooYnhABo7vVcJ4Jl', name: 'CertificadoPtmosPromotor.pdf' },
  { id: '1BX0NUOfAhryyw-ONEKd7IUNQiXN_oBVI', name: 'NOTA-SIMPLE-P16.1.pdf' },
];

const DRIVE_DIR = path.join(__dirname, '..', 'scripts', 'drive');
const OUT_DIR = path.join(__dirname);

async function getDrive() {
  const credentials = JSON.parse(fs.readFileSync(path.join(DRIVE_DIR, 'credentials.json')));
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(path.join(DRIVE_DIR, 'token.json'))));
  return google.drive({ version: 'v3', auth: oAuth2Client });
}

async function downloadFile(drive, fileId, destPath) {
  const dest = fs.createWriteStream(destPath);
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
  await new Promise((resolve, reject) => {
    res.data.on('end', resolve).on('error', reject).pipe(dest);
  });
}

(async () => {
  const drive = await getDrive();
  for (const f of files) {
    const dest = path.join(OUT_DIR, f.name);
    process.stdout.write(`Downloading ${f.name}... `);
    await downloadFile(drive, f.id, dest);
    console.log('done');
  }
  console.log('\nAll files downloaded to', OUT_DIR);
})().catch(e => { console.error(e.message); process.exit(1); });
