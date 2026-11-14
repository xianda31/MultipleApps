import { importRowSchema, type ImportRow } from '../../../../../common/nfc-contract';

const headers = ['prenom', 'nom', 'licence', 'uid'];

export function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], value = '', quoted = false, closed = false;
  const source = content.replace(/^\uFEFF/, '');
  const delimiter = source.split(/\r?\n/, 1)[0].includes(';') ? ';' : ',';
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { value += '"'; index++; }
      else if (char === '"') { quoted = false; closed = true; }
      else value += char;
    } else if (char === delimiter || char === '\n' || char === '\r') {
      row.push(value); value = ''; closed = false;
      if (char !== delimiter) {
        rows.push(row); row = [];
        if (char === '\r' && source[index + 1] === '\n') index++;
      }
    } else if (char === '"' && value === '' && !closed) quoted = true;
    else {
      if (closed || char === '"') throw new Error('CSV invalide : guillemets mal placés.');
      value += char;
    }
  }
  if (quoted) throw new Error('CSV invalide : guillemet non fermé.');
  if (value || row.length || closed) rows.push([...row, value]);
  return rows;
}

export function importRows(table: unknown[][]): ImportRow[] {
  const heading = table[0]?.map(value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase());
  if (!heading || heading.length !== 4 || !headers.every((value, index) => heading[index] === value)) {
    throw new Error('Colonnes attendues dans cet ordre : prenom, nom, licence, uid.');
  }
  const rows = table.slice(1);
  while (rows.length && rows[rows.length - 1].every(value => value === '' || value === null)) rows.pop();
  if (!rows.length || rows.length > 500) throw new Error('Le fichier doit contenir de 1 à 500 cartes.');
  return rows.map((row, index) => {
    if (row.length !== 4 || row.some(value => typeof value !== 'string')) {
      throw new Error(`Ligne ${index + 2} : quatre cellules texte requises (licences et UID sans conversion numérique).`);
    }
    return importRowSchema.parse({ firstname: row[0], lastname: row[1], licenseNumber: row[2], uid: row[3] });
  });
}

export async function readImportFile(file: File): Promise<ImportRow[]> {
  if (file.size > 2 * 1024 * 1024) throw new Error('Fichier trop volumineux (maximum 2 Mo).');
  if (/\.csv$/i.test(file.name)) return importRows(parseCsv(await file.text()));
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Sélectionnez un fichier .csv ou .xlsx.');
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  if (workbook.worksheets.length !== 1) throw new Error('Le classeur doit contenir une seule feuille.');
  const sheet = workbook.worksheets[0];
  if (sheet.rowCount > 501 || sheet.columnCount !== 4) throw new Error('Maximum 500 cartes et exactement quatre colonnes.');
  const table: unknown[][] = [];
  sheet.eachRow({ includeEmpty: true }, row => {
    table.push([1, 2, 3, 4].map(index => row.getCell(index).value ?? ''));
  });
  return importRows(table);
}

export function csvReport(rows: unknown[][]): string {
  return '\uFEFF' + rows.map(row => row.map(value => {
    let text = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return `"${text.replace(/"/g, '""')}"`;
  }).join(';')).join('\r\n');
}
