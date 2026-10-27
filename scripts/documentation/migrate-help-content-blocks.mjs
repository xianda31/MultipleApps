import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const DEFAULT_CONTENT_PATH = path.join(
  PROJECT_ROOT,
  'projects',
  'admin',
  'src',
  'assets',
  'documentation',
  'back-online-help.json',
);
const DEFAULT_REPORT_PATH = path.join(
  PROJECT_ROOT,
  'dist',
  'documentation',
  'back-online-help-block-migration.json',
);

function normalizeText(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .toLowerCase();
}

function legacyTextEntries(topic) {
  return [
    ...(topic.summary ? [{ field: 'summary', value: topic.summary }] : []),
    ...(topic.functionalities ?? []).map((value, index) => ({
      field: `functionalities[${index}]`,
      value,
    })),
    ...(topic.howTo ?? []).map((value, index) => ({
      field: `howTo[${index}]`,
      value,
    })),
    ...(topic.procedures ?? []).flatMap((procedure, procedureIndex) => [
      { field: `procedures[${procedureIndex}].title`, value: procedure.title },
      ...procedure.steps.map((value, stepIndex) => ({
        field: `procedures[${procedureIndex}].steps[${stepIndex}]`,
        value,
      })),
    ]),
    ...(topic.caution ?? []).map((value, index) => ({
      field: `caution[${index}]`,
      value,
    })),
  ];
}

function findAmbiguities(topic) {
  const occurrences = new Map();
  for (const entry of legacyTextEntries(topic)) {
    const key = normalizeText(entry.value);
    if (!key) continue;
    const values = occurrences.get(key) ?? [];
    values.push(entry);
    occurrences.set(key, values);
  }
  return [...occurrences.values()]
    .filter((entries) => entries.length > 1)
    .map((entries) => ({
      topicId: topic.id,
      content: entries[0].value,
      fields: entries.map((entry) => entry.field),
      reason: 'Texte identique présent dans plusieurs champs historiques ; conservé pour relecture.',
    }));
}

export function migrateTopic(topic) {
  const blocks = [];
  if (topic.summary) {
    blocks.push({
      id: 'introduction',
      type: 'text',
      paragraphs: [topic.summary],
    });
  }
  if (topic.functionalities?.length) {
    blocks.push({
      id: 'fonctionnalites',
      type: 'list',
      title: 'Fonctionnalités couvertes',
      items: [...topic.functionalities],
    });
  }
  if (topic.howTo?.length) {
    blocks.push({
      id: 'parcours-conseille',
      type: 'procedure',
      title: 'Parcours conseillé',
      steps: [...topic.howTo],
    });
  }
  for (const procedure of topic.procedures ?? []) {
    blocks.push({
      id: procedure.id,
      type: 'procedure',
      title: procedure.title,
      steps: [...procedure.steps],
    });
  }
  if (topic.caution?.length) {
    blocks.push({
      id: 'points-vigilance',
      type: 'attention',
      title: 'Points de vigilance',
      messages: [...topic.caution],
    });
  }
  for (const illustration of topic.illustrations ?? []) {
    blocks.push({
      id: `illustration-${illustration.id}`,
      type: 'illustration',
      illustrationId: illustration.id,
      ...(illustration.caption ? { caption: illustration.caption } : {}),
    });
  }

  const {
    functionalities,
    howTo,
    procedures,
    caution,
    children,
    ...metadata
  } = topic;
  return {
    ...metadata,
    blocks,
    ...(children ? { children: children.map(migrateTopic) } : {}),
  };
}

export function migrateDocument(document) {
  return {
    ...document,
    version: '2026-10-27.7',
    topics: document.topics.map(migrateTopic),
  };
}

function compareValues(expected, actual, context, issues) {
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    issues.push({
      context,
      reason: 'Le contenu migré diffère du contenu historique attendu.',
      expected,
      actual,
    });
  }
}

export function compareMigration(legacyDocument, migratedDocument) {
  const issues = [];
  const ambiguities = [];
  let topicCount = 0;
  let textCount = 0;
  let illustrationCount = 0;
  const blockCounts = {};

  const compareTopics = (legacyTopics, migratedTopics, parentId = 'root') => {
    compareValues(
      legacyTopics.map((topic) => topic.id),
      migratedTopics.map((topic) => topic.id),
      `${parentId}: ordre des rubriques`,
      issues,
    );
    legacyTopics.forEach((legacyTopic, index) => {
      const migratedTopic = migratedTopics[index];
      if (!migratedTopic || migratedTopic.id !== legacyTopic.id) return;
      topicCount += 1;
      textCount += legacyTextEntries(legacyTopic).length;
      illustrationCount += legacyTopic.illustrations?.length ?? 0;
      ambiguities.push(...findAmbiguities(legacyTopic));

      const expected = migrateTopic(legacyTopic);
      compareValues(
        expected.blocks,
        migratedTopic.blocks,
        `${legacyTopic.id}: blocs`,
        issues,
      );
      compareValues(
        legacyTopic.illustrations ?? [],
        migratedTopic.illustrations ?? [],
        `${legacyTopic.id}: illustrations`,
        issues,
      );
      for (const block of migratedTopic.blocks ?? []) {
        blockCounts[block.type] = (blockCounts[block.type] ?? 0) + 1;
      }
      compareTopics(
        legacyTopic.children ?? [],
        migratedTopic.children ?? [],
        legacyTopic.id,
      );
    });
  };

  compareTopics(legacyDocument.topics, migratedDocument.topics);
  return {
    sourceVersion: legacyDocument.version,
    targetVersion: migratedDocument.version,
    topicCount,
    textCount,
    illustrationCount,
    blockCounts,
    ambiguities,
    issues,
    preserved: issues.length === 0,
  };
}

function runMigration(
  contentPath = DEFAULT_CONTENT_PATH,
  reportPath = DEFAULT_REPORT_PATH,
) {
  const legacyDocument = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
  if (legacyDocument.topics.some((topic) => Array.isArray(topic.blocks))) {
    throw new Error('La base documentaire utilise déjà les blocs ordonnés.');
  }
  const migratedDocument = migrateDocument(legacyDocument);
  const report = compareMigration(legacyDocument, migratedDocument);
  if (!report.preserved) {
    throw new Error(`Migration interrompue : ${report.issues.length} écart(s) détecté(s).`);
  }
  fs.writeFileSync(contentPath, `${JSON.stringify(migratedDocument, null, 2)}\n`, 'utf8');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}

const invokedAsScript = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) {
  try {
    const report = runMigration();
    console.log(`Rubriques migrées: ${report.topicCount}`);
    console.log(`Textes contrôlés: ${report.textCount}`);
    console.log(`Illustrations contrôlées: ${report.illustrationCount}`);
    console.log(`Ambiguïtés conservées: ${report.ambiguities.length}`);
    console.log(`Rapport: ${DEFAULT_REPORT_PATH}`);
  } catch (error) {
    console.error(`Échec de migration: ${error.message}`);
    process.exitCode = 1;
  }
}
