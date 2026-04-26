const imapSimple = require('imap-simple');
const { simpleParser } = require('mailparser');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

function getConfig() {
  return {
    imap: {
      user: process.env.IMAP_USER,
      password: process.env.IMAP_PASSWORD,
      host: process.env.IMAP_HOST || 'imap.ionos.com',
      port: parseInt(process.env.IMAP_PORT || '993'),
      tls: true,
      authTimeout: 10000,
    },
  };
}

function detectAttachment(struct) {
  const parts = imapSimple.getParts(struct);
  return parts.some(p => p.disposition && p.disposition.type.toUpperCase() === 'ATTACHMENT');
}

function formatHeader(msg) {
  const part = msg.parts.find(p => p.which === 'HEADER.FIELDS (FROM SUBJECT DATE)');
  const h = part.body;
  return {
    uid: msg.attributes.uid,
    subject: h.subject ? h.subject[0].trim() : '(no subject)',
    from: h.from ? h.from[0].trim() : '',
    date: h.date ? h.date[0].trim() : '',
    hasAttachment: detectAttachment(msg.attributes.struct),
  };
}

async function listEmails(folder = 'INBOX', limit = 10) {
  const connection = await imapSimple.connect(getConfig());
  try {
    await connection.openBox(folder);
    const messages = await connection.search(['ALL'], {
      bodies: ['HEADER.FIELDS (FROM SUBJECT DATE)'],
      struct: true,
    });
    return messages.slice(-limit).reverse().map(formatHeader);
  } finally {
    connection.end();
  }
}

async function readEmail(folder = 'INBOX', emailId) {
  if (!emailId) throw new Error('emailId is required');
  const connection = await imapSimple.connect(getConfig());
  try {
    await connection.openBox(folder);
    const messages = await connection.search([['UID', String(emailId)]], {
      bodies: [''],
      struct: true,
    });
    if (!messages.length) throw new Error(`No email found with UID ${emailId}`);
    const raw = messages[0].parts.find(p => p.which === '').body;
    const parsed = await simpleParser(raw);
    return {
      uid: emailId,
      subject: parsed.subject || '(no subject)',
      from: parsed.from ? parsed.from.text : '',
      date: parsed.date ? parsed.date.toISOString() : '',
      body: parsed.text || parsed.html || '',
      attachments: (parsed.attachments || []).map(a => ({
        filename: a.filename || '(unnamed)',
        contentType: a.contentType,
        size: a.size,
      })),
    };
  } finally {
    connection.end();
  }
}

async function searchEmails(query) {
  if (!query) throw new Error('query is required');
  const connection = await imapSimple.connect(getConfig());
  try {
    await connection.openBox('INBOX');
    const messages = await connection.search(
      [['OR', ['FROM', query], ['SUBJECT', query]]],
      {
        bodies: ['HEADER.FIELDS (FROM SUBJECT DATE)'],
        struct: true,
      }
    );
    return messages.reverse().slice(0, 20).map(formatHeader);
  } finally {
    connection.end();
  }
}

module.exports = { listEmails, readEmail, searchEmails };

if (require.main !== module) return;

const [,, command, ...args] = process.argv;

const commands = {
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
      console.error('Usage: node email.js readEmail <uid> [folder]');
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
      console.error('Usage: node email.js searchEmails <query>');
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
};

if (!command || !commands[command]) {
  console.error(`Available commands: ${Object.keys(commands).join(', ')}`);
  process.exit(1);
}

commands[command](args).catch(err => {
  console.error(err.message);
  process.exit(1);
});
