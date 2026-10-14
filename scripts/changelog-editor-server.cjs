const http = require('http');
const fs = require('fs/promises');
const path = require('path');

const HOST = '127.0.0.1';
const PORT = 4301;
const MAX_BODY_SIZE = 256 * 1024;
const DATA_PATH = path.resolve(
  __dirname,
  '..',
  'projects',
  'admin',
  'src',
  'app',
  'back',
  'change-log',
  'change-log.data.json',
);
const AREAS = new Set([
  'TOURNOIS',
  'BOUTIQUE',
  'ADHERENTS',
  'COMPTABILITE',
  'PAIEMENTS',
  'SITE_WEB',
  'COMMUNICATION',
  'GENERAL',
]);
const KINDS = new Set(['NEW', 'IMPROVEMENT', 'FIX']);
const SITES = new Set(['BACK_OFFICE', 'FRONT']);
const ALLOWED_FIELDS = new Set(['id', 'publishedOn', 'site', 'area', 'kind', 'summary']);

function validateEntries(value) {
  if (!Array.isArray(value)) {
    throw new Error('Le change log doit être une liste');
  }

  const ids = new Set();
  return value.map((candidate, index) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new Error(`Entrée ${index + 1} invalide`);
    }
    if (Object.keys(candidate).some((key) => !ALLOWED_FIELDS.has(key))) {
      throw new Error(`Champ inconnu dans l’entrée ${index + 1}`);
    }

    const id = requiredString(candidate.id, `Identifiant de l’entrée ${index + 1}`);
    const publishedOn = requiredString(candidate.publishedOn, `Date de l’entrée ${index + 1}`);
    const site = candidate.site === undefined
      ? 'BACK_OFFICE'
      : requiredString(candidate.site, `Site de l’entrée ${index + 1}`);
    const area = requiredString(candidate.area, `Rubrique de l’entrée ${index + 1}`);
    const kind = requiredString(candidate.kind, `Nature de l’entrée ${index + 1}`);
    const summary = requiredString(candidate.summary, `Résumé de l’entrée ${index + 1}`);

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
      throw new Error(`Identifiant invalide : ${id}`);
    }
    if (ids.has(id)) {
      throw new Error(`Identifiant dupliqué : ${id}`);
    }
    ids.add(id);
    if (!isValidIsoDate(publishedOn)) {
      throw new Error(`Date invalide pour ${id} : ${publishedOn}`);
    }
    if (!SITES.has(site)) {
      throw new Error(`Site invalide pour ${id} : ${site}`);
    }
    if (!AREAS.has(area)) {
      throw new Error(`Rubrique invalide pour ${id} : ${area}`);
    }
    if (!KINDS.has(kind)) {
      throw new Error(`Nature invalide pour ${id} : ${kind}`);
    }
    if (summary.length > 160) {
      throw new Error(`Le résumé de ${id} dépasse 160 caractères`);
    }
    if (summary.includes('\uFFFD')) {
      throw new Error(`Le résumé de ${id} contient des caractères d’encodage invalides`);
    }

    return { id, publishedOn, site, area, kind, summary };
  });
}

function sortEntries(entries) {
  return [...entries].sort((left, right) =>
    right.publishedOn.localeCompare(left.publishedOn) || left.id.localeCompare(right.id)
  );
}

function requiredString(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} manquant`);
  }
  return value.trim();
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

async function readEntries() {
  const content = await fs.readFile(DATA_PATH, 'utf8');
  return sortEntries(validateEntries(JSON.parse(content)));
}

async function writeEntries(value) {
  const entries = sortEntries(validateEntries(value));
  const temporaryPath = `${DATA_PATH}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
  await fs.rename(temporaryPath, DATA_PATH);
  return entries;
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body, 'utf8') > MAX_BODY_SIZE) {
        reject(new Error('Le change log dépasse la taille autorisée'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Corps JSON invalide'));
      }
    });
    request.on('error', reject);
  });
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(`${JSON.stringify(value)}\n`);
}

function isLocalRequest(request) {
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress);
}

function createServer() {
  return http.createServer(async (request, response) => {
    if (!isLocalRequest(request)) {
      sendJson(response, 403, { error: 'Accès local uniquement' });
      return;
    }
    if (request.url !== '/api/changelog') {
      sendJson(response, 404, { error: 'Route inconnue' });
      return;
    }

    try {
      if (request.method === 'GET') {
        sendJson(response, 200, await readEntries());
        return;
      }
      if (request.method === 'PUT') {
        sendJson(response, 200, await writeEntries(await readJsonBody(request)));
        return;
      }
      sendJson(response, 405, { error: 'Méthode non autorisée' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      const status = error instanceof SyntaxError || !message.startsWith('ENOENT') ? 400 : 500;
      if (status === 500) {
        console.error('[Change log]', error);
      }
      sendJson(response, status, { error: message });
    }
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, HOST, () => {
    console.log(`[Change log] Éditeur local disponible sur http://${HOST}:${PORT}`);
  });
  server.on('error', (error) => {
    console.error('[Change log] Impossible de démarrer le service local:', error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  DATA_PATH,
  createServer,
  sortEntries,
  validateEntries,
};
