const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

async function getDrive() {
  const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, 'credentials.json')));
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(path.join(__dirname, 'token.json'))));
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

if (require.main !== module) return;

const [,, command, ...args] = process.argv;

const commands = {
  createProject: async ([code, city, promoter, parentId]) => {
    if (!code || !city || !promoter) {
      console.error('Usage: node drive.js createProject <code> <city> <promoter> [parentFolderId]');
      process.exit(1);
    }
    await createProjectStructure(code, city, promoter, parentId || null);
  },
  createFolder: async ([name, parentId]) => {
    if (!name) {
      console.error('Usage: node drive.js createFolder <name> [parentFolderId]');
      process.exit(1);
    }
    await createFolder(name, parentId || null);
  },
  listFolder: async ([folderId]) => {
    if (!folderId) {
      console.error('Usage: node drive.js listFolder <folderId>');
      process.exit(1);
    }
    await listFolder(folderId);
  },
  uploadFile: async ([filePath, folderId]) => {
    if (!filePath || !folderId) {
      console.error('Usage: node drive.js uploadFile <filePath> <folderId>');
      process.exit(1);
    }
    await uploadFile(filePath, folderId);
  },
};

if (!command) {
  console.error('Available commands: createProject, createFolder, listFolder, uploadFile');
  process.exit(1);
}

if (!commands[command]) {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

commands[command](args).catch(err => {
  console.error(err.message);
  process.exit(1);
});