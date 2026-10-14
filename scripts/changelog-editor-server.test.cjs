const assert = require('node:assert/strict');
const test = require('node:test');
const { sortEntries, validateEntries } = require('./changelog-editor-server.cjs');

test('validates and sorts change log entries', () => {
  const entries = validateEntries([
    {
      id: '2026-10-13-export-membres',
      publishedOn: '2026-10-13',
      site: 'BACK_OFFICE',
      area: 'ADHERENTS',
      kind: 'NEW',
      summary: 'Le répertoire peut être exporté.',
    },
    {
      id: '2026-10-14-achat-zero',
      publishedOn: '2026-10-14',
      site: 'FRONT',
      area: 'BOUTIQUE',
      kind: 'IMPROVEMENT',
      summary: 'Les achats couverts peuvent être validés.',
    },
  ]);

  assert.deepEqual(sortEntries(entries).map((entry) => entry.id), [
    '2026-10-14-achat-zero',
    '2026-10-13-export-membres',
  ]);
});

test('rejects unknown fields', () => {
  assert.throws(() => validateEntries([{
    id: '2026-10-14-invalid',
    publishedOn: '2026-10-14',
    site: 'BACK_OFFICE',
    area: 'GENERAL',
    kind: 'FIX',
    summary: 'Entrée invalide.',
    hidden: true,
  }]), /Champ inconnu/);
});

test('rejects corrupted UTF-8 text', () => {
  assert.throws(() => validateEntries([{
    id: '2026-10-14-invalid-encoding',
    publishedOn: '2026-10-14',
    site: 'BACK_OFFICE',
    area: 'GENERAL',
    kind: 'FIX',
    summary: 'Texte corrompu � vérifier.',
  }]), /encodage invalides/);
});

test('defaults legacy entries without a site to the back office', () => {
  const [entry] = validateEntries([{
    id: '2026-10-01-ancienne-entree',
    publishedOn: '2026-10-01',
    area: 'GENERAL',
    kind: 'FIX',
    summary: 'Une ancienne entrée reste lisible.',
  }]);

  assert.equal(entry.site, 'BACK_OFFICE');
});
