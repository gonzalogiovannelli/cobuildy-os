const { createProjectStructure, uploadFile, listFolder } = require('./scripts/drive/drive.js');
const { listEmails, readEmail, searchEmails } = require('./scripts/email/email.js');

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
  email: {
    listEmails: async ([folder, limit]) => {
      const emails = await listEmails(folder, limit ? parseInt(limit) : 10);
      if (!emails.length) { console.log('No emails found.'); return; }
      emails.forEach(e => {
        console.log(`[${e.uid}] ${e.date}`);
        console.log(`  From: ${e.from}`);
        console.log(`  Subj: ${e.subject}${e.hasAttachment ? '  [attachment]' : ''}`);
      });
    },
    readEmail: async ([uid, folder]) => {
      if (!uid) {
        console.error('Usage: node cobuildy.js email readEmail <uid> [folder]');
        process.exit(1);
      }
      const email = await readEmail(folder, uid);
      console.log(`Subject: ${email.subject}`);
      console.log(`From:    ${email.from}`);
      console.log(`Date:    ${email.date}`);
      if (email.attachments.length) {
        console.log('\nAttachments:');
        email.attachments.forEach(a =>
          console.log(`  - ${a.filename} (${a.contentType}, ${a.size} bytes)`)
        );
      }
      console.log(`\n${email.body}`);
    },
    searchEmails: async ([query]) => {
      if (!query) {
        console.error('Usage: node cobuildy.js email searchEmails <query>');
        process.exit(1);
      }
      const emails = await searchEmails(query);
      if (!emails.length) { console.log('No emails found.'); return; }
      emails.forEach(e => {
        console.log(`[${e.uid}] ${e.date}`);
        console.log(`  From: ${e.from}`);
        console.log(`  Subj: ${e.subject}${e.hasAttachment ? '  [attachment]' : ''}`);
      });
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
