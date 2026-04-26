const { createProjectStructure, uploadFile, listFolder } = require('./scripts/drive/drive.js');
const { listEmails, readEmail, searchEmails } = require('./scripts/email/email.js');
const { listLeads, getLead, getLeadNotes, listContacts } = require('./scripts/kommo/kommo.js');

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
  kommo: {
    listLeads: async ([limit, page]) => {
      const leads = await listLeads(limit ? parseInt(limit) : 25, page ? parseInt(page) : 1);
      if (!leads.length) { console.log('No leads found.'); return; }
      leads.forEach(l => {
        console.log(`[${l.id}] ${l.name}`);
        console.log(`  Pipeline: ${l.pipeline}  →  ${l.status}`);
        console.log(`  Owner: ${l.responsible_user}  |  Updated: ${l.updated_at}`);
      });
    },
    getLead: async ([id]) => {
      if (!id) { console.error('Usage: node cobuildy.js kommo getLead <id>'); process.exit(1); }
      const lead = await getLead(id);
      console.log(JSON.stringify(lead, null, 2));
    },
    getLeadNotes: async ([id]) => {
      if (!id) { console.error('Usage: node cobuildy.js kommo getLeadNotes <id>'); process.exit(1); }
      const notes = await getLeadNotes(id);
      if (!notes.length) { console.log('No notes found.'); return; }
      notes.forEach(n => {
        console.log(`[${n.created_at}] ${n.created_by}  (${n.type})`);
        if (n.text) console.log(`  ${n.text}`);
      });
    },
    listContacts: async ([limit, page]) => {
      const contacts = await listContacts(limit ? parseInt(limit) : 25, page ? parseInt(page) : 1);
      if (!contacts.length) { console.log('No contacts found.'); return; }
      contacts.forEach(c => {
        console.log(`[${c.id}] ${c.name}`);
        if (c.email) console.log(`  Email: ${c.email}`);
        if (c.phone) console.log(`  Phone: ${c.phone}`);
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
