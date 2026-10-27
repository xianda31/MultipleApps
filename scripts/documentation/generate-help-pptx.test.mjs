import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import JSZip from 'jszip';
import {
  buildPresentationModel,
  calculateImageContainBox,
  createPresentation,
  loadPresentationInputs,
  PROJECT_ROOT,
  validateTheme,
} from './generate-help-pptx.mjs';
import { HELP_PPTX_THEME } from './help-pptx-theme.mjs';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function flattenTopics(topics) {
  return topics.flatMap((topic) => [topic, ...flattenTopics(topic.children ?? [])]);
}

async function presentationZip(model) {
  const pptx = createPresentation(model);
  const buffer = await pptx.write({ outputType: 'nodebuffer', compression: true });
  return JSZip.loadAsync(buffer);
}

test('separates font families and sizes and enforces readable body sizes', () => {
  assert.equal(typeof HELP_PPTX_THEME.fontFamilies.heading, 'string');
  assert.equal(typeof HELP_PPTX_THEME.fontFamilies.body, 'string');
  assert.equal(typeof HELP_PPTX_THEME.fontSizes.body, 'number');
  assert.equal(typeof HELP_PPTX_THEME.appIconPath, 'string');
  assert.ok(fs.existsSync(path.resolve(PROJECT_ROOT, HELP_PPTX_THEME.appIconPath)));
  assert.equal('fonts' in HELP_PPTX_THEME, false);
  assert.doesNotThrow(() => validateTheme(HELP_PPTX_THEME));

  const invalidTheme = clone(HELP_PPTX_THEME);
  invalidTheme.fontSizes.compactBody = invalidTheme.minimumBodyFontSize - 1;
  assert.throws(
    () => validateTheme(invalidTheme),
    /Taille de corps compactBody inférieure au minimum/,
  );
});

test('preserves and centers intrinsic illustration proportions', () => {
  const images = [
    {
      path: path.join(
        PROJECT_ROOT,
        'projects',
        'admin',
        'src',
        'assets',
        'documentation',
        'images',
        'repertoire-gestion-membres.png',
      ),
      ratio: 805 / 627,
    },
    {
      path: path.join(
        PROJECT_ROOT,
        'projects',
        'admin',
        'src',
        'assets',
        'documentation',
        'images',
        'carte-admissions-parcours.svg',
      ),
      ratio: 1200 / 560,
    },
  ];

  for (const image of images) {
    const area = { x: 0.7, y: 1.35, w: 11.93, h: 4.95 };
    const box = calculateImageContainBox(
      image.path,
      area.x,
      area.y,
      area.w,
      area.h,
    );
    assert.ok(Math.abs((box.w / box.h) - image.ratio) < 0.0001);
    assert.ok(Math.abs((box.x + box.w / 2) - (area.x + area.w / 2)) < 0.0001);
    assert.ok(Math.abs((box.y + box.h / 2) - (area.y + area.h / 2)) < 0.0001);
    assert.ok(box.w <= area.w && box.h <= area.h);
  }
});

test('includes every published topic in document order and reports planned topics', () => {
  const { document, config } = loadPresentationInputs();
  const model = buildPresentationModel(document, config);
  const allTopics = flattenTopics(document.topics);
  const expectedIncluded = allTopics
    .filter((topic) => topic.contentStatus !== 'planned')
    .map((topic) => topic.id);
  const expectedPlanned = allTopics
    .filter((topic) => topic.contentStatus === 'planned')
    .map((topic) => topic.id);

  assert.deepEqual(model.coverage.included.map((topic) => topic.id), expectedIncluded);
  assert.deepEqual(model.coverage.planned.map((topic) => topic.id), expectedPlanned);
  assert.equal(model.coverage.empty.length, 0);
  assert.equal(model.coverage.unsupported.length, 0);
  assert.ok(model.coverage.planned.every((topic) => topic.reason));

  const chapterIds = model.pages
    .filter((page) => page.kind === 'chapter')
    .map((page) => page.topic.id);
  const orderedChapterIds = chapterIds.filter(
    (chapterId, index) => index === 0 || chapterId !== chapterIds[index - 1],
  );
  assert.deepEqual(
    orderedChapterIds,
    document.topics
      .filter((topic) => topic.contentStatus !== 'planned')
      .map((topic) => topic.id),
  );
  assert.ok(chapterIds.filter((chapterId) => chapterId === 'comptabilite').length > 1);
});

test('consumes ordered blocks and groups short blocks on the same slide', () => {
  const { document, config } = loadPresentationInputs();
  const model = buildPresentationModel(document, config);
  const tournamentPages = model.pages.filter(
    (page) => page.kind === 'content' && page.topic.id === 'tournois',
  );
  const source = document.topics.find((topic) => topic.id === 'tournois');

  assert.deepEqual(
    tournamentPages.flatMap((page) => page.blocks.map((block) => block.id)),
    source.blocks.map((block) => block.id),
  );
  assert.ok(tournamentPages.some((page) => page.blocks.length > 1));
});

test('reports exact cross-block duplicates without removing them', () => {
  const { document, config } = loadPresentationInputs();
  const baselineModel = buildPresentationModel(document, config);
  const duplicatedDocument = clone(document);
  const tournament = duplicatedDocument.topics.find((topic) => topic.id === 'tournois');
  const list = tournament.blocks.find((block) => block.type === 'list');
  const procedure = tournament.blocks.find((block) => block.type === 'procedure');
  procedure.steps[0] = list.items[0];

  const model = buildPresentationModel(duplicatedDocument, config);
  assert.equal(
    model.coverage.ambiguities.length,
    baselineModel.coverage.ambiguities.length + 1,
  );
  const injectedAmbiguity = model.coverage.ambiguities.find(
    (ambiguity) => ambiguity.id === 'tournois' && ambiguity.content === list.items[0],
  );
  assert.ok(injectedAmbiguity);
  assert.match(injectedAmbiguity.reason, /conservé pour relecture/);

  const displayedContent = model.pages
    .filter((page) => page.kind === 'content' && page.topic.id === 'tournois')
    .flatMap((page) => page.blocks)
    .flatMap((block) => blockTextValues(block));
  assert.equal(
    displayedContent.filter((item) => item === list.items[0]).length,
    2,
  );
});

function blockTextValues(block) {
  return block.paragraphs
    ?? block.items
    ?? block.steps
    ?? block.messages
    ?? [];
}

test('paginates a long block without changing its order or body font', () => {
  const { document, config } = loadPresentationInputs();
  const paginatedDocument = clone(document);
  const tournament = paginatedDocument.topics.find((topic) => topic.id === 'tournois');
  const procedure = tournament.blocks.find((block) => block.type === 'procedure');
  procedure.steps = Array.from(
    { length: 24 },
    (_, index) => `Étape ${index + 1} de contrôle du tournoi avant validation.`,
  );

  const model = buildPresentationModel(paginatedDocument, config);
  const procedureFragments = model.pages
    .filter((page) => page.kind === 'content' && page.topic.id === 'tournois')
    .flatMap((page) => page.blocks)
    .filter((block) => block.id === procedure.id);
  assert.ok(procedureFragments.length > 1);
  assert.deepEqual(
    procedureFragments.flatMap((block) => block.steps),
    procedure.steps,
  );
  assert.deepEqual(
    procedureFragments.map((block) => block.startIndex),
    procedureFragments.map((_, index, fragments) => fragments
      .slice(0, index)
      .reduce((count, block) => count + block.steps.length, 0)),
  );
});

test('reports an unsupported illustration with its reason', () => {
  const { document, config } = loadPresentationInputs();
  const missingIllustrationDocument = clone(document);
  const directory = missingIllustrationDocument.topics
    .flatMap((topic) => topic.children ?? [])
    .find((topic) => topic.id === 'adherents-repertoire');
  directory.illustrations[0].path = '/assets/documentation/images/absente.png';

  const model = buildPresentationModel(missingIllustrationDocument, config);
  const exclusion = model.coverage.unsupported.find(
    (topic) => topic.id === 'adherents-repertoire',
  );
  assert.match(exclusion.reason, /fichier d’illustration introuvable/);
});

test('reports unsupported block types instead of ignoring them', () => {
  const { document, config } = loadPresentationInputs();
  const unsupportedDocument = clone(document);
  const tournament = unsupportedDocument.topics.find((topic) => topic.id === 'tournois');
  tournament.blocks.push({ id: 'unknown', type: 'unknown' });

  const model = buildPresentationModel(unsupportedDocument, config);
  const exclusion = model.coverage.unsupported.find(
    (entry) => entry.id === 'tournois' && entry.blockId === 'unknown',
  );
  assert.match(exclusion.reason, /type de bloc non pris en charge/);
});

test('creates a traceable PowerPoint containing every supported block type', async () => {
  const { config } = loadPresentationInputs();
  const illustrationPath = '/assets/documentation/images/carte-admissions-parcours.svg';
  const document = {
    version: 'block-test',
    topics: [
      {
        id: 'block-chapter',
        title: 'Chapitre blocs',
        summary: 'Résumé de navigation',
        blocks: [
          { id: 'text', type: 'text', title: 'Texte', paragraphs: ['Paragraphe PPTX'] },
          { id: 'list', type: 'list', title: 'Liste', items: ['Élément PPTX'] },
          { id: 'procedure', type: 'procedure', title: 'Procédure', steps: ['Étape PPTX'] },
          {
            id: 'illustration',
            type: 'illustration',
            illustrationId: 'schema',
            caption: 'Légende PPTX',
          },
          {
            id: 'table',
            type: 'table',
            title: 'Tableau',
            columns: ['Colonne A', 'Colonne B'],
            rows: [['Cellule A', 'Cellule B']],
          },
          { id: 'attention', type: 'attention', title: 'Attention', messages: ['Message PPTX'] },
        ],
        illustrations: [
          {
            id: 'schema',
            path: illustrationPath,
            alt: 'Schéma test',
          },
        ],
      },
    ],
  };
  const model = buildPresentationModel(document, config);
  const zip = await presentationZip(model);
  const entries = Object.keys(zip.files);

  assert.ok(entries.includes('[Content_Types].xml'));
  assert.equal(
    entries.filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).length,
    model.pages.length + 1,
  );

  const slideXml = (await Promise.all(
    entries
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .map((name) => zip.file(name).async('string')),
  )).join('\n');
  for (const text of [
    'Paragraphe PPTX',
    'Élément PPTX',
    'Étape PPTX',
    'Légende PPTX',
    'Colonne A',
    'Cellule B',
    'Message PPTX',
  ]) {
    assert.ok(slideXml.includes(text), `Texte documentaire absent du PPTX: ${text}`);
  }
  assert.ok(slideXml.includes('anchor="ctr"'));
  assert.equal(slideXml.includes('anchor="mid"'), false);

  const notesXml = (await Promise.all(
    entries
      .filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name))
      .map((name) => zip.file(name).async('string')),
  )).join('\n');
  assert.ok(notesXml.includes(`Version documentaire: ${model.documentVersion}`));
  assert.ok(notesXml.includes('Blocs: text'));
  assert.ok(notesXml.includes('procedure'));
  assert.ok(notesXml.includes('illustration'));

  for (const page of model.pages.filter((candidate) => candidate.kind === 'content')) {
    for (const block of page.blocks.filter((candidate) => candidate.type === 'illustration')) {
      const extension = path.extname(block.illustration.filePath).toLowerCase().slice(1);
      const sourceImage = fs.readFileSync(block.illustration.filePath);
      const matchingMedia = await Promise.all(
        entries
          .filter((name) => name.startsWith('ppt/media/') && name.endsWith(`.${extension}`))
          .map((name) => zip.file(name).async('nodebuffer')),
      );
      assert.ok(
        matchingMedia.some((media) => sourceImage.equals(media)),
        `Illustration absente du PPTX: ${block.illustrationId}`,
      );
    }
  }
});
