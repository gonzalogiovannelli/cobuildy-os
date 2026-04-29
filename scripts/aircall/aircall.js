// Minimal Aircall API client (read-only). Auth: Basic with API ID + Token.
// See https://developer.aircall.io for the call schema.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const ID    = (process.env.AIRCALL_API_ID    || '').trim();
const TOKEN = (process.env.AIRCALL_API_TOKEN || '').trim();
const BASE  = 'https://api.aircall.io/v1';
const AUTH  = 'Basic ' + Buffer.from(`${ID}:${TOKEN}`).toString('base64');

async function api(endpoint) {
  if (!ID || !TOKEN) {
    throw new Error('AIRCALL_API_ID / AIRCALL_API_TOKEN missing in scripts/.env');
  }
  const res = await fetch(BASE + endpoint, { headers: { Authorization: AUTH } });
  if (!res.ok) {
    throw new Error(`Aircall ${res.status} on ${endpoint}: ${await res.text()}`);
  }
  return res.json();
}

// Paginate through /calls between two unix timestamps. Aircall caps page
// size at 50; we keep going until the page is short.
async function* paginateCalls({ fromUnix, toUnix, perPage = 50 } = {}) {
  let page = 1;
  while (true) {
    const params = new URLSearchParams({
      per_page: String(perPage),
      page:     String(page),
      order:    'asc',
    });
    if (fromUnix) params.set('from', String(fromUnix));
    if (toUnix)   params.set('to',   String(toUnix));

    const data  = await api(`/calls?${params.toString()}`);
    const calls = data.calls || [];
    if (calls.length === 0) return;
    for (const c of calls) yield c;
    if (calls.length < perPage) return;
    page++;
  }
}

module.exports = { api, paginateCalls };
