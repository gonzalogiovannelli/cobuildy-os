const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const DRIVE_DIR = path.join(__dirname, '..', 'scripts', 'drive');
const PARENT_FOLDER = '1DApDCNaEju7wLX6FKgqlwiIcLBPkc0JX';

const FILES = JSON.parse(fs.readFileSync(path.join(__dirname, 'renames.json')));

const DESCRIPTIONS = {
  'ES-002-cuentas-anuales-Polandrius-2023.pdf': 'Cuentas anuales 2023 firmadas para depósito en Registro Mercantil — Inversiones Polandrius S.L.',
  'ES-002-cuentas-anuales-Polandrius-2024.pdf': 'Cuentas anuales 2024 firmadas — Inversiones Polandrius S.L.',
  'ES-002-certificacion-aprobacion-cuentas-Polandrius-2023.pdf': 'Certificación Junta General de aprobación de cuentas anuales 2023 + balance + memoria abreviada — Inversiones Polandrius S.L.',
  'ES-002-balance-provisional-Polandrius-2025.pdf': 'Balance de situación provisional a 31/12/2025 — Inversiones Polandrius S.L.',
  'ES-002-balance-provisional-Polandrius-2025-copia.pdf': 'Balance de situación provisional a 31/12/2025 (copia) — Inversiones Polandrius S.L.',
  'ES-002-certificado-deuda-CajaRural-Polandrius.pdf': 'Certificado de deuda emitido por Caja Rural de Navarra: 3 préstamos promotor (800k + 1.1M + 800k €) — Inversiones Polandrius',
  'ES-002-tabla-clientes-precios-Olcoz.xlsx': 'Tabla con todos los clientes/compradores y precios de venta de las 29 viviendas de Castillo de Olcoz',
  'ES-002-movimientos-cuenta-corriente.pdf': 'Movimientos de cuenta corriente — Inversiones Polandrius',
  'ES-002-movimientos-P15.pdf': 'Movimientos bancarios asociados a la Parcela 15 (sector S-1 Olcoz)',
  'ES-002-movimientos-P16.pdf': 'Movimientos bancarios asociados a la Parcela 16 (sector S-1 Olcoz)',
  'ES-002-movimientos-P17.pdf': 'Movimientos bancarios asociados a la Parcela 17 (sector S-1 Olcoz)',

  'ES-002-poliza-prestamo-1100000-Olcoz.pdf': 'Póliza de préstamo promotor 1.100.000€ — Caja Rural / Olcoz',
  'ES-002-poliza-prestamo-800000-Olcoz.pdf': 'Póliza de préstamo promotor 800.000€ — Caja Rural / Olcoz',
  'ES-002-poliza-prestamo-P16-2-8viv.pdf': 'Póliza de préstamo Parcela 16.2 — 8 viviendas',
  'ES-002-poliza-trc-MartinezSanchez-29viv.pdf': 'Póliza TRC (Todo Riesgo Construcción) — Construcciones Martínez Sánchez Cintruego — 29 viviendas Olcoz',
  'ES-002-seguro-decenal-Olcoz.pdf': 'Seguro decenal de la promoción Castillo de Olcoz',

  'ES-002-certificacion-obra-feb2026-5viv.pdf': 'Certificación de obra febrero 2026 — 5 viviendas Olcoz',
  'ES-002-certificacion-obra-mar2026-7viv.pdf': 'Certificación de obra marzo 2026 — 7 viviendas Olcoz',
  'ES-002-certificacion-obra-mar2026-8viv.pdf': 'Certificación de obra marzo 2026 — 8 viviendas Olcoz',
  'ES-002-certificacion-obra-mar2026-9viv.pdf': 'Certificación de obra marzo 2026 — 9 viviendas Olcoz',

  'ES-002-organigrama-Polandrius.pdf': 'Organigrama del personal de Inversiones Polandrius',
  'ES-002-certificado-registro-mercantil-Polandrius.pdf': 'Certificado del Registro Mercantil — Inversiones Polandrius S.L.',
  'ES-002-acta-titular-real-Polandrius.pdf': 'Acta de identificación de titular real (PBC) — Inversiones Polandrius',
  'ES-002-declaracion-unipersonalidad-Polandrius.pdf': 'Declaración de unipersonalidad — Inversiones Polandrius',
  'ES-002-certificado-residencia-fiscal.pdf': 'Certificado de residencia fiscal',
  'ES-002-dossier-Polandrius.pdf': 'Dossier corporativo de Inversiones Polandrius',

  'ES-002-estudio-viabilidad-33viv-Olcoz.pdf': 'Estudio de viabilidad — 33 viviendas Olcoz',
  'ES-002-dossier-equipo-tecnico-Olcoz.pdf': 'Dossier del equipo técnico (arquitectos, dirección facultativa) — Olcoz',
  'ES-002-catalogo-Olcoz-2hab.pdf': 'Catálogo comercial — viviendas de 2 habitaciones — Castillo de Olcoz (Nov 2025)',
  'ES-002-catalogo-Olcoz-3hab.pdf': 'Catálogo comercial — viviendas de 3 habitaciones — Castillo de Olcoz (actualizado)',
  'ES-002-tabla-parcelas-Olcoz.pdf': 'Tabla resumen de parcelas — Olcoz v3',
  'ES-002-planos-adosadas-Olcoz.pdf': 'Planos arquitectónicos de las viviendas adosadas — Olcoz',
  'ES-002-contrato-arquitectos-Olcoz.pdf': 'Contrato con el equipo de arquitectos — Olcoz',
  'ES-002-contrato-construccion-MartinezSanchez-29viv.pdf': 'Contrato de construcción con Martínez Sánchez — 29 viviendas Olcoz',
  'ES-002-nota-explicativa-P16.pdf': 'Nota explicativa sobre la Parcela 16 del Sector S1 de Olcoz',
  'ES-002-lista-documentos-requeridos.xlsx': 'Lista (checklist) de documentación requerida del proyecto',

  'ES-002-nota-simple-P16-2.pdf': 'Nota simple del Registro de la Propiedad — Parcela 16.2',
  'ES-002-nota-simple-P17.pdf': 'Nota simple del Registro de la Propiedad — Parcela 17',
  'ES-002-nota-simple-P15.pdf': 'Nota simple del Registro de la Propiedad — Parcela 15',
  'ES-002-nota-simple-escritura-compraventa-parcelas-Olcoz.pdf': 'Nota simple — escritura de compraventa de las parcelas Olcoz (1748-C)',

  'ES-002-informe-liquidacion-Banur.pdf': 'Informe de liquidación Art. 424 LC — Concurso 241/2022 Banur Soluciones Comerciales S.L. (Juzgado Mercantil Nº 1 Pamplona)',
  'ES-002-informe-liquidacion-Banur-juzgado.pdf': 'Informe de liquidación 424 LEC — Concurso Banur (versión del juzgado)',
  'ES-002-comunicacion-edicto-Banur-art468TRLC.pdf': 'Comunicación + edicto + auto de conclusión Art. 468 TRLC — Concurso Banur',
  'ES-002-diligencia-ordenacion-Banur-S5.pdf': 'Diligencia de ordenación S5 — informe estado operaciones — Concurso Banur',

  'ES-002-contrato-arras-modelo-P16-13adosados.pdf': 'Modelo de contrato de arras 2 hab — Parcela 16-369 — 13 adosados',
  'ES-002-contrato-arras-modelo-P16-13adosados-copia.pdf': 'Modelo de contrato de arras 2 hab — Parcela 16-369 — 13 adosados (copia)',
};

// Default description generator for contract files
function makeDescription(name) {
  if (DESCRIPTIONS[name]) return DESCRIPTIONS[name];
  if (name.includes('contrato-compraventa')) {
    const parts = name.replace('ES-002-contrato-compraventa-', '').replace('.pdf', '').split('-');
    const isCopy = parts[parts.length - 1].startsWith('copia');
    const buyer = parts.filter(p => !p.startsWith('V') && !p.startsWith('copia')).join(' ');
    const v = parts.find(p => /^V\d+/.test(p));
    return `Contrato de compraventa — comprador(es): ${buyer}${v ? ` — Vivienda ${v}` : ''}${isCopy ? ' (copia)' : ''} — Promoción Castillo de Olcoz`;
  }
  if (name.includes('contrato-arras')) {
    const parts = name.replace('ES-002-contrato-arras-', '').replace('.pdf', '').split('-');
    const isCopy = parts[parts.length - 1].startsWith('copia');
    const buyer = parts.filter(p => !p.startsWith('V') && !p.startsWith('copia')).join(' ');
    const v = parts.find(p => /^V\d+/.test(p));
    return `Contrato de arras — comprador(es): ${buyer}${v ? ` — Vivienda ${v}` : ''}${isCopy ? ' (copia)' : ''} — Promoción Castillo de Olcoz`;
  }
  return name;
}

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

  // 1. Create sheet inside the parent folder
  console.log('Creating Google Sheet...');
  const fileRes = await drive.files.create({
    resource: {
      name: 'ES-002-document-index',
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [PARENT_FOLDER],
    },
    fields: 'id,name,webViewLink',
  });
  const sheetId = fileRes.data.id;
  console.log(`Sheet created: ${fileRes.data.name} (${sheetId})`);
  console.log(`Link: ${fileRes.data.webViewLink}`);

  // 2. Sort files by category, then by name
  const sorted = [...FILES].sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name);
  });

  // 3. Build rows
  const rows = [['Category', 'File Name', 'Description', 'File Link']];
  for (const f of sorted) {
    const link = `https://drive.google.com/file/d/${f.id}/view`;
    rows.push([f.category, f.name, makeDescription(f.name), link]);
  }

  // 4. Write rows
  console.log(`Writing ${rows.length - 1} rows...`);
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'A1',
    valueInputOption: 'USER_ENTERED',
    resource: { values: rows },
  });

  // 5. Format: bold header, freeze header, autosize columns
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    resource: {
      requests: [
        {
          repeatCell: {
            range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.85, green: 0.92, blue: 0.83 } } },
            fields: 'userEnteredFormat(textFormat,backgroundColor)',
          },
        },
        {
          updateSheetProperties: {
            properties: { sheetId: 0, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount',
          },
        },
        {
          autoResizeDimensions: {
            dimensions: { sheetId: 0, dimension: 'COLUMNS', startIndex: 0, endIndex: 4 },
          },
        },
      ],
    },
  });

  console.log('\n✅ Sheet created and populated successfully.');
  console.log(`📋 ${rows.length - 1} files indexed`);
  console.log(`🔗 ${fileRes.data.webViewLink}`);
})().catch(e => { console.error(e.message); console.error(e.stack); process.exit(1); });
