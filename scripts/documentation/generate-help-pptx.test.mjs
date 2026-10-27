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

test('restores functionalities and howTo without requiring procedures', () => {
  const { document, config } = loadPresentationInputs();
  const model = buildPresentationModel(document, config);
  const tournamentPages = model.pages.filter((page) => page.topic.id === 'tournois');
  const overview = tournamentPages.find((page) => page.sourceFields?.includes('functionalities'));
  const howTo = tournamentPages.find((page) => page.sourceFields?.includes('howTo'));
  const source = document.topics.find((topic) => topic.id === 'tournois');

  assert.deepEqual(overview.items, source.functionalities);
  assert.deepEqual(howTo.items, source.howTo);
  assert.equal(overview.procedures, undefined);
  assert.equal(howTo.procedures, undefined);
});

test('reports exact cross-field duplicates instead of repeating them silently', () => {
  const { document, config } = loadPresentationInputs();
  const duplicatedDocument = clone(document);
  const tournament = duplicatedDocument.topics.find((topic) => topic.id === 'tournois');
  tournament.howTo[0] = tournament.functionalities[0];

  const model = buildPresentationModel(duplicatedDocument, config);
  assert.equal(model.coverage.ambiguities.length, 1);
  assert.equal(model.coverage.ambiguities[0].id, 'tournois');
  assert.match(model.coverage.ambiguities[0].reason, /affichée une seule fois/);

  const displayedItems = model.pages
    .filter((page) => page.topic.id === 'tournois')
    .flatMap((page) => page.items ?? []);
  assert.equal(
    displayedItems.filter((item) => item === tournament.functionalities[0]).length,
    1,
  );
});

test('paginates long existing fields without reducing the configured body font', () => {
  const { document, config } = loadPresentationInputs();
  const paginatedDocument = clone(document);
  const tournament = paginatedDocument.topics.find((topic) => topic.id === 'tournois');
  tournament.howTo = Array.from(
    { length: 24 },
    (_, index) => `Étape ${index + 1} de contrôle du tournoi avant validation.`,
  );

  const model = buildPresentationModel(paginatedDocument, config);
  const howToPages = model.pages.filter(
    (page) => page.topic.id === 'tournois' && page.sourceFields?.includes('howTo'),
  );
  assert.ok(howToPages.length > 1);
  assert.deepEqual(howToPages.flatMap((page) => page.items), tournament.howTo);
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

test('creates a traceable complete PowerPoint with all supported field types', async () => {
  const { document, config } = loadPresentationInputs();
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
  const tournament = document.topics.find((topic) => topic.id === 'tournois');
  for (const text of [
    tournament.summary,
    ...tournament.functionalities,
    ...tournament.howTo,
    ...tournament.caution,
  ]) {
    assert.ok(slideXml.includes(text), `Texte documentaire absent du PPTX: ${text}`);
  }
  assert.equal(slideXml.includes('Structure du chapitre général consacré'), false);

  const notesXml = (await Promise.all(
    entries
      .filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name))
      .map((name) => zip.file(name).async('string')),
  )).join('\n');
  assert.ok(notesXml.includes(`Version documentaire: ${model.documentVersion}`));
  assert.ok(notesXml.includes('Champs: functionalities'));
  assert.ok(notesXml.includes('Champs: howTo'));

  for (const page of model.pages.filter((candidate) => candidate.kind === 'content')) {
    for (const illustration of page.illustrations ?? []) {
      const extension = path.extname(illustration.filePath).toLowerCase().slice(1);
      const sourceImage = fs.readFileSync(illustration.filePath);
      const matchingMedia = await Promise.all(
        entries
          .filter((name) => name.startsWith('ppt/media/') && name.endsWith(`.${extension}`))
          .map((name) => zip.file(name).async('nodebuffer')),
      );
      assert.ok(
        matchingMedia.some((media) => sourceImage.equals(media)),
        `Illustration absente du PPTX: ${illustration.id}`,
      );
    }
  }
});
