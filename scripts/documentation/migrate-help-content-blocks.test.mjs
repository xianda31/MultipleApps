import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compareMigration,
  migrateDocument,
} from './migrate-help-content-blocks.mjs';

function legacyDocument() {
  return {
    version: 'legacy',
    topics: [
      {
        id: 'chapter',
        title: 'Chapitre',
        summary: 'Résumé conservé.',
        functionalities: ['Fonction A'],
        howTo: ['Étape historique'],
        procedures: [
          {
            id: 'procedure-stable',
            title: 'Procédure stable',
            steps: ['Première étape', 'Deuxième étape'],
          },
        ],
        caution: ['Attention historique'],
        illustrations: [
          {
            id: 'schema',
            path: '/schema.svg',
            alt: 'Schéma',
            caption: 'Légende historique',
          },
        ],
        children: [
          {
            id: 'child',
            title: 'Enfant',
            summary: 'Contenu enfant.',
            functionalities: [],
            howTo: [],
          },
        ],
      },
    ],
  };
}

test('migrates every legacy field to stable ordered blocks without loss', () => {
  const legacy = legacyDocument();
  const migrated = migrateDocument(legacy);
  const report = compareMigration(legacy, migrated);

  assert.equal(report.preserved, true);
  assert.equal(report.topicCount, 2);
  assert.equal(report.textCount, 8);
  assert.equal(report.illustrationCount, 1);
  assert.deepEqual(
    migrated.topics[0].blocks.map((block) => [block.id, block.type]),
    [
      ['introduction', 'text'],
      ['fonctionnalites', 'list'],
      ['parcours-conseille', 'procedure'],
      ['procedure-stable', 'procedure'],
      ['points-vigilance', 'attention'],
      ['illustration-schema', 'illustration'],
    ],
  );
});

test('signals text loss and preserves ambiguous repetitions for review', () => {
  const legacy = legacyDocument();
  legacy.topics[0].howTo[0] = legacy.topics[0].functionalities[0];
  const migrated = migrateDocument(legacy);
  migrated.topics[0].blocks
    .find((block) => block.id === 'procedure-stable')
    .steps.pop();

  const report = compareMigration(legacy, migrated);
  assert.equal(report.preserved, false);
  assert.equal(report.issues.length, 1);
  assert.equal(report.ambiguities.length, 1);
  assert.match(report.ambiguities[0].reason, /conservé pour relecture/);
});
