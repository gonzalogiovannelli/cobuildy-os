const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const DRIVE_DIR = path.join(__dirname, '..', 'scripts', 'drive');

const files = [
  { id: '1smDYdljfH3SIio3jp2p0nmV5UPalLTe9', name: 'comunicacion-edicto.pdf' },
  { id: '15r6xkZ_KmBhwkCHg-kNopfUXSxWhvyZE', name: '0241-S5-diligencia.pdf' },
  { id: '1bXPS5lF0lnlYzW9_sbylx_6vmFYclArm', name: '0241-informe-424.pdf' },
  { id: '1e1rkDhjqUAy26sxDWaeLEgD2zmy7f7cJ', name: '1748-csimple-escritura.pdf' },
  { id: '1raRepV0jBqSSlgBYlPwU0dcsMdgUIzvl', name: 'certificadoAP.pdf' },
  { id: '1a3K1r2zYltny-XSov68j2jAdMiNY0XvD', name: 'certificado-residencia.pdf' },
  { id: '1a5FbAkXPe5ogL5Mfgrso9kZxbfl4XAGm', name: 'acta-titular-real.pdf' },
  { id: '15EZJck8_E0e72RCO9L-RFDkBL4Q6cVIJ', name: 'declaracion-unipersonalidad.pdf' },
  { id: '1lS6cZXmQJCBUm6DzdTCxmQnUjsKFH1rl', name: 'arras-modelo-P16-369.pdf' },
];

async function getDrive() {
  const credentials = JSON.parse(fs.readFileSync(path.join(DRIVE_DIR, 'credentials.json')));
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  auth.setCredentials(JSON.parse(fs.readFileSync(path.join(DRIVE_DIR, 'token.json'))));
  return google.drive({ version: 'v3', auth });
}

async function downloadFile(drive, fileId, destPath) {
  const dest = fs.createWriteStream(destPath);
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
  await new Promise((resolve, reject) => res.data.on('end', resolve).on('error', reject).pipe(dest));
}

(async () => {
  const drive = await getDrive();
  for (const f of files) {
    process.stdout.write(`Downloading ${f.name}... `);
    await downloadFile(drive, f.id, path.join(__dirname, f.name));
    console.log('done');
  }
})().catch(e => { console.error(e.message); process.exit(1); });
