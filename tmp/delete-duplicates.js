const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const DRIVE_DIR = path.join(__dirname, '..', 'scripts', 'drive');
const PARENT_FOLDER = '1DApDCNaEju7wLX6FKgqlwiIcLBPkc0JX';
const SHEET_ID = '1WZpb2w4NPxeNqxq1w6clgRHAJgZas-nkZ7e5uaInYS0';

// Files to delete (clear duplicates with a non-copia counterpart that already exists)
const TO_DELETE = [
  '1ctMVuQG1cOigUNWkE8os0pqCpctefXvu', // CarlosJavierGoñi-V25-copia
  '19vsXImbbunacQESJ1DfT3SX4vq76d6_u', // JudithJaso-copia
  '1VlaY_4Wn5fXAAGeqkh-fFRrjMMNE-vne', // FerminGarcia-V16-copia
  '1kviCf7O9jtBDVbJuKHTqE_9L2x2YqkDY', // EiderOcaña-SergioMiranda-copia
  '1_JX8X5ax5ULKJfx_CXW9nYmV_KXt_WUF', // AdrianAdot-copia1 (was "Copia de... - copia" — double-marked)
  '1GUd8lGIf2bSZkUs_IEkWkvuNQnJVIXSQ', // AmaiaAponte-V21-copia
  '1oEp_VuM6HIRCdGeUbbbO17j2HeXQ7jbC', // VioletaSantos-copia
  '1tmkPSw89M8gKQ8u7RHa4iL6r40EeyJL5', // Yolanda-Eduardo-copia
  '1SGEc2DLuxGIUBW9BauUC8fYHqJX8tJTg', // FcoJavierAyerra-Sheila-V28-copia
  '1U203hh4fuiMfJkKeq9A0M0pLw7lRu15C', // DavidPastor-V29-copia
  '1dVbw0G6C7NBDc46g-d3Rj_dC0s0bfe8S', // JavierRuiz-V23-copia
  '1ZTqk8ZtUSmvojWebdrRIBVmYuFOg9anI', // RubenPerez-Lydia-V26-copia
  '1Mp_tZtQpkiLwSin8Dz5zjWiS-VDO6Yq3', // TamaraGoñi-V24-copia
  '1iryv83u5jhS6HH0jCyK2qczfuK6y6thM', // FcoJavierArive-Victoria-copia
  '1VXh2uwBVacL8IgZ6cpKMkBiep29CZqYi', // AfricaNalda-copia
  '1LZ3F6-r0uctQqzpFBwpz3_zVltjSSPv4', // LeireMartinez-V7-copia
  '1dDvo8rhN3X5cmdS0-YabqoELbDuC997p', // Anderson-Andrea-V22-copia
  '1vm9byIucgCBkDhHzPywu0opwZWO5fmMU', // MaiderAyape-Ibai-V12-copia
  '1Ju0XhCDtEoV-s38XZxg8zUR5vIIydqV_', // PedroCalatayud-Gloria-V27-copia
  '1K7T2M2rbZz4eyNfj7_3PcdnqvKenznfk', // Grace-Dennis-copia
  '1-iutTlykLNNRIFFYuYy7iAhKrdxu5DBq', // Natalia-David-copia
  '1rhp3PyJICsJ2-ujZyOARwr9phj-2UzoG', // Ainhoa-Xabier-V17-copia
  '1lS6cZXmQJCBUm6DzdTCxmQnUjsKFH1rl', // contrato-arras-modelo-P16-13adosados-copia
  '1plRQrV7mufsgxbIubgXQoDY7pihza0oK', // balance-provisional-Polandrius-2025-copia
];

// AdrianAdot-copia2 → keep, rename to canonical (no -copia suffix)
const RENAME = { id: '1EDhSTEaie0DzsxrcRQNktCtzSrzC8GlB', name: 'ES-002-contrato-compraventa-AdrianAdot.pdf' };

async function getAuth() {
  const credentials = JSON.parse(fs.readFileSync(path.join(DRIVE_DIR, 'credentials.json')));
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  auth.setCredentials(JSON.parse(fs.readFileSync(path.join(DRIVE_DIR, 'token.json'))));
  return auth;
}

(async () => {
  const auth = await getAuth();
  const drive = google.drive({ version: 'v3', auth });
  const sheets = google.sheets({ version: 'v4', auth });

  // 1. Delete duplicates
  for (const id of TO_DELETE) {
    process.stdout.write(`Deleting ${id}... `);
    try {
      await drive.files.delete({ fileId: id });
      console.log('done');
    } catch (e) {
      console.log(`FAILED: ${e.message}`);
    }
  }

  // 2. Rename AdrianAdot-copia2 to canonical
  console.log(`\nRenaming AdrianAdot-copia2 → ${RENAME.name}`);
  await drive.files.update({ fileId: RENAME.id, resource: { name: RENAME.name } });

  // 3. Rebuild the index sheet from current Drive folder state
  console.log('\nRebuilding index sheet...');
  const res = await drive.files.list({
    q: `'${PARENT_FOLDER}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, webViewLink)',
    pageSize: 200,
  });
  const allFiles = res.data.files;

  // Filter: skip jpg/jpeg/png and the index sheet itself
  const eligible = allFiles.filter(f => {
    const lower = f.name.toLowerCase();
    if (f.mimeType === 'application/vnd.google-apps.spreadsheet' && f.name === 'ES-002-document-index') return false;
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png')) return false;
    return true;
  });

  // Categorize
  function categorize(name) {
    if (name.includes('contrato-compraventa')) return 'Contratos - Compraventa';
    if (name.includes('contrato-arras')) return 'Contratos - Arras';
    if (name.includes('contrato-arquitectos') || name.includes('contrato-construccion')) return 'Proyecto - Contratos técnicos';
    if (name.includes('nota-simple')) return 'Legal - Notas Simples';
    if (name.includes('Banur')) return 'Legal - Concurso Banur';
    if (name.includes('cuentas-anuales') || name.includes('certificacion-aprobacion-cuentas')) return 'Financial - Cuentas anuales';
    if (name.includes('certificado-deuda')) return 'Financial - Préstamos';
    if (name.includes('balance-')) return 'Financial - Balance';
    if (name.includes('movimientos')) return 'Financial - Movimientos';
    if (name.includes('certificacion-obra')) return 'Obra - Certificaciones';
    if (name.includes('poliza-prestamo')) return 'Pólizas - Préstamo';
    if (name.includes('poliza-trc') || name.includes('seguro-decenal')) return 'Pólizas - Seguros';
    if (name.includes('Polandrius') || name.includes('residencia-fiscal') || name.includes('titular-real') || name.includes('unipersonalidad') || name.includes('organigrama')) return 'Corporate - Polandrius';
    if (name.includes('catalogo')) return 'Proyecto - Catálogo';
    if (name.includes('planos')) return 'Proyecto - Planos';
    if (name.includes('viabilidad') || name.includes('dossier-equipo') || name.includes('tabla-parcelas') || name.includes('nota-explicativa') || name.includes('lista-documentos')) return 'Proyecto - Estudios';
    if (name.includes('tabla-clientes-precios')) return 'Comercial - Pricing';
    return 'Otros';
  }

  // Inline description generator (using same heuristics)
  const DESCRIPTIONS = JSON.parse(fs.readFileSync(path.join(__dirname, 'descriptions.json'), 'utf8'));
  function describe(name) {
    if (DESCRIPTIONS[name]) return DESCRIPTIONS[name];
    if (name.includes('contrato-compraventa')) {
      const parts = name.replace('ES-002-contrato-compraventa-', '').replace('.pdf', '').split('-');
      const buyer = parts.filter(p => !/^V\d+/.test(p) && !p.startsWith('copia')).join(' ');
      const v = parts.find(p => /^V\d+/.test(p));
      return `Contrato de compraventa — comprador(es): ${buyer}${v ? ` — Vivienda ${v}` : ''} — Promoción Castillo de Olcoz`;
    }
    if (name.includes('contrato-arras')) {
      const parts = name.replace('ES-002-contrato-arras-', '').replace('.pdf', '').split('-');
      const buyer = parts.filter(p => !/^V\d+/.test(p) && !p.startsWith('copia')).join(' ');
      const v = parts.find(p => /^V\d+/.test(p));
      return `Contrato de arras — comprador(es): ${buyer}${v ? ` — Vivienda ${v}` : ''} — Promoción Castillo de Olcoz`;
    }
    return name;
  }

  const rows = eligible
    .map(f => ({
      category: categorize(f.name),
      name: f.name,
      description: describe(f.name),
      link: `https://drive.google.com/file/d/${f.id}/view`,
    }))
    .sort((a, b) => a.category !== b.category ? a.category.localeCompare(b.category) : a.name.localeCompare(b.name));

  const values = [['Category', 'File Name', 'Description', 'File Link']];
  for (const r of rows) values.push([r.category, r.name, r.description, r.link]);

  // Clear existing content and rewrite
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: 'A1:Z1000' });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: 'A1',
    valueInputOption: 'USER_ENTERED',
    resource: { values },
  });

  console.log(`✅ Sheet updated — ${values.length - 1} files indexed (after dedup).`);
  console.log(`Deleted ${TO_DELETE.length} duplicate files.`);
})().catch(e => { console.error(e.message); console.error(e.stack); process.exit(1); });
