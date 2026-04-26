const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

async function getDrive() {
  const credentials = JSON.parse(fs.readFileSync('credentials.json'));
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oAuth2Client.setCredentials(JSON.parse(fs.readFileSync('token.json')));
  return google.drive({ version: 'v3', auth: oAuth2Client });
}

async function createFolder(name, parentId = null) {
  const drive = await getDrive();
  const metadata = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
    ...(parentId && { parents: [parentId] })
  };
  const res = await drive.files.create({ resource: metadata, fields: 'id, name' });
  console.log(`Folder created: ${res.data.name} (${res.data.id})`);
  return res.data.id;
}

async function createProjectStructure(projectCode, city, promoter, parentId = null) {
  console.log(`\nCreating project structure for ${projectCode}...`);
  const projectFolder = await createFolder(`${projectCode} - ${city} - ${promoter}`, parentId);
  await createFolder('Documents', projectFolder);
  await createFolder('Calls', projectFolder);
  await createFolder('Legal', projectFolder);
  await createFolder('Financial', projectFolder);
  console.log(`\nProject ${projectCode} structure ready.`);
  return projectFolder;
}

async function uploadFile(filePath, folderId) {
  const drive = await getDrive();
  const fileName = path.basename(filePath);
  const res = await drive.files.create({
    resource: { name: fileName, parents: [folderId] },
    media: { body: fs.createReadStream(filePath) },
    fields: 'id, name'
  });
  console.log(`File uploaded: ${res.data.name} (${res.data.id})`);
  return res.data.id;
}

async function listFolder(folderId) {
  const drive = await getDrive();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, createdTime)'
  });
  console.log('\nFolder contents:');
  res.data.files.forEach(f => console.log(` - ${f.name} (${f.id})`));
  return res.data.files;
}

module.exports = { createFolder, createProjectStructure, uploadFile, listFolder };

// Test
async function test() {
  const rootId = await createFolder('Cobuildy OS - Test Environment');
  await createProjectStructure('ES-001', 'Malaga', 'NZPromocion', rootId);
}

test();