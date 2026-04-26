const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const TOKEN     = (process.env.KOMMO_TOKEN     || '').trim();
const SUBDOMAIN = (process.env.KOMMO_SUBDOMAIN || '').trim();

// ── API client ────────────────────────────────────────────────────────────────

const BASE_URL = TOKEN && SUBDOMAIN ? `https://${SUBDOMAIN}.kommo.com/api/v4` : null;

console.error('[kommo] base URL:', BASE_URL ?? '(not configured)');
console.error('[kommo] token preview:', TOKEN ? TOKEN.slice(0, 50) + '...' : '(empty)');

async function kommoGet(endpoint, params = {}) {
  if (!BASE_URL) {
    throw new Error('KOMMO_TOKEN and KOMMO_SUBDOMAIN must be set in scripts/.env');
  }
  const url = new URL(BASE_URL + endpoint);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(String(k), String(v));
  }

  console.error('[kommo] GET', url.toString());

  const res = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Kommo ${res.status} on ${url.toString()}: ${body}`);
  }
  return res.json();
}

// ── Per-run caches (pipelines and users fetched at most once) ─────────────────

let _pipelineCache = null;
let _userCache     = null;

async function getPipelineCache() {
  if (_pipelineCache) return _pipelineCache;
  const data = await kommoGet('/pipelines');
  const pipelineMap = {};
  const statusMap   = {};
  for (const p of data._embedded?.pipelines || []) {
    pipelineMap[p.id] = p.name;
    for (const s of p._embedded?.statuses || []) {
      statusMap[s.id] = s.name;
    }
  }
  _pipelineCache = { pipelineMap, statusMap };
  return _pipelineCache;
}

async function getUserCache() {
  if (_userCache) return _userCache;
  const data = await kommoGet('/users');
  _userCache = {};
  for (const u of data._embedded?.users || []) {
    _userCache[u.id] = u.name;
  }
  return _userCache;
}

// ── Field helpers ─────────────────────────────────────────────────────────────

function extractCustomFields(values = []) {
  const result = {};
  for (const field of values) {
    const name = field.field_name || field.field_code || String(field.field_id);
    const val  = (field.values || []).map(v => v.value).filter(Boolean).join(', ');
    if (val) result[name] = val;
  }
  return result;
}

function extractByCode(values = [], code) {
  const field = values.find(f => f.field_code === code);
  return field?.values?.[0]?.value || '';
}

function fmtDate(unix) {
  if (!unix) return '';
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

// ── Public functions ──────────────────────────────────────────────────────────

async function listLeads(limit = 25, page = 1) {
  const data = await kommoGet('/leads', { limit, page });

  return (data._embedded?.leads || []).map(lead => ({
    id:                  lead.id,
    name:                lead.name,
    status_id:           lead.status_id,
    pipeline_id:         lead.pipeline_id,
    responsible_user_id: lead.responsible_user_id,
    created_at:          fmtDate(lead.created_at),
    updated_at:          fmtDate(lead.updated_at),
  }));
}

async function getLead(id) {
  const [lead, pl, um] = await Promise.all([
    kommoGet(`/leads/${id}`, { with: 'contacts' }),
    getPipelineCache(),
    getUserCache(),
  ]);

  return {
    id:               lead.id,
    name:             lead.name,
    status:           pl.statusMap[lead.status_id]           || String(lead.status_id),
    pipeline:         pl.pipelineMap[lead.pipeline_id]       || String(lead.pipeline_id),
    responsible_user: um[lead.responsible_user_id]           || String(lead.responsible_user_id),
    price:            lead.price,
    created_at:       fmtDate(lead.created_at),
    updated_at:       fmtDate(lead.updated_at),
    contacts:         (lead._embedded?.contacts || []).map(c => ({ id: c.id, name: c.name })),
    custom_fields:    extractCustomFields(lead.custom_fields_values),
  };
}

async function getLeadNotes(id) {
  const [data, um] = await Promise.all([
    kommoGet(`/leads/${id}/notes`, { limit: 250 }),
    getUserCache(),
  ]);

  return (data._embedded?.notes || []).map(note => ({
    id:         note.id,
    type:       note.note_type,
    text:       note.params?.text || note.params?.uniq_id || '',
    created_by: um[note.created_by] || String(note.created_by),
    created_at: fmtDate(note.created_at),
  }));
}

async function listContacts(limit = 25, page = 1) {
  const data = await kommoGet('/contacts', { limit, page });

  return (data._embedded?.contacts || []).map(c => ({
    id:    c.id,
    name:  c.name,
    email: extractByCode(c.custom_fields_values, 'EMAIL'),
    phone: extractByCode(c.custom_fields_values, 'PHONE'),
  }));
}

async function getContact(id) {
  const [contact, um] = await Promise.all([
    kommoGet(`/contacts/${id}`, { with: 'leads' }),
    getUserCache(),
  ]);

  return {
    id:               contact.id,
    name:             contact.name,
    responsible_user: um[contact.responsible_user_id] || String(contact.responsible_user_id),
    created_at:       fmtDate(contact.created_at),
    updated_at:       fmtDate(contact.updated_at),
    email:            extractByCode(contact.custom_fields_values, 'EMAIL'),
    phone:            extractByCode(contact.custom_fields_values, 'PHONE'),
    custom_fields:    extractCustomFields(contact.custom_fields_values),
    leads:            (contact._embedded?.leads || []).map(l => ({ id: l.id, name: l.name })),
  };
}

module.exports = { listLeads, getLead, getLeadNotes, listContacts, getContact };

if (require.main !== module) return;

const [,, command, ...args] = process.argv;

const commands = {
  listLeads: async ([limit, page]) => {
    const leads = await listLeads(limit ? parseInt(limit) : 25, page ? parseInt(page) : 1);
    if (!leads.length) { console.log('No leads found.'); return; }
    leads.forEach(l => {
      console.log(`[${l.id}] ${l.name}`);
      console.log(`  pipeline_id: ${l.pipeline_id}  status_id: ${l.status_id}`);
      console.log(`  responsible_user_id: ${l.responsible_user_id}  |  updated: ${l.updated_at}`);
    });
  },
  getLead: async ([id]) => {
    if (!id) { console.error('Usage: node kommo.js getLead <id>'); process.exit(1); }
    const lead = await getLead(id);
    console.log(JSON.stringify(lead, null, 2));
  },
  getLeadNotes: async ([id]) => {
    if (!id) { console.error('Usage: node kommo.js getLeadNotes <id>'); process.exit(1); }
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
  getContact: async ([id]) => {
    if (!id) { console.error('Usage: node kommo.js getContact <id>'); process.exit(1); }
    const contact = await getContact(id);
    console.log(JSON.stringify(contact, null, 2));
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
