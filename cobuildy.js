const { createProjectStructure, uploadFile, listFolder } = require('./scripts/drive/drive.js');

const [,, mod, command, ...args] = process.argv;

const router = {
  drive: {
    createProject: async ([code, city, promoter]) => {
      if (!code || !city || !promoter) {
        console.error('Usage: node cobuildy.js drive createProject <code> <city> <promoter>');
        process.exit(1);
      }
      await createProjectStructure(code, city, promoter);
    },
    listFolder: async ([folderId]) => {
      if (!folderId) {
        console.error('Usage: node cobuildy.js drive listFolder <folderId>');
        process.exit(1);
      }
      await listFolder(folderId);
    },
    uploadFile: async ([filePath, folderId]) => {
      if (!filePath || !folderId) {
        console.error('Usage: node cobuildy.js drive uploadFile <filePath> <folderId>');
        process.exit(1);
      }
      await uploadFile(filePath, folderId);
    },
  },
};

if (!mod || !router[mod]) {
  console.error(`Available mods: ${Object.keys(router).join(', ')}`);
  process.exit(1);
}

if (!command || !router[mod][command]) {
  console.error(`Available ${mod} commands: ${Object.keys(router[mod]).join(', ')}`);
  process.exit(1);
}

router[mod][command](args).catch(err => {
  console.error(err.message);
  process.exit(1);
});
