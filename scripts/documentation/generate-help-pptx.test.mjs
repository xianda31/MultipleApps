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
  const themeWithoutIcon = clone(HELP_PPTX_THEME);
  themeWithoutIcon.appIconPath = '';
  assert.throws(
    () => validateTheme(themeWithoutIcon),
    /Chemin de l’icône d’application invalide/,
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

test('resolves every configured topic, procedure and illustration', () => {
  const { document, config } = loadPresentationInputs();
  const model = buildPresentationModel(document, config);

  assert.equal(model.openingTopics.length, 3);
  assert.equal(model.slides.length, 16);
  assert.deepEqual(
    model.openingTopics.map((topic) => topic.id),
    ['adherents-repertoire', 'adherents-cartes', 'adherents-controles'],
  );
  assert.ok(model.slides.flatMap((slide) => slide.illustrations).every(
    (illustration) => fs.existsSync(illustration.filePath),
  ));
  const directoryIllustrationSlide = model.slides.find(
    (slide) => slide.illustrations[0]?.id === 'schema-gestion-repertoire',
  );
  assert.equal(directoryIllustrationSlide.topic.id, 'adherents-repertoire');
  assert.equal(directoryIllustrationSlide.title, 'Gestion des membres — schéma de référence');
  assert.deepEqual(directoryIllustrationSlide.traceProcedureIds, ['synchronisation-repertoire']);

  const illustratedSlide = model.slides.find(
    (slide) => slide.illustrations[0]?.id === 'parcours-carte-admissions',
  );
  assert.equal(illustratedSlide.topic.id, 'adherents-cartes');
  assert.equal(illustratedSlide.title, 'Création des cartes — schéma');
  assert.deepEqual(illustratedSlide.traceProcedureIds, ['creation-automatique']);
  assert.equal(illustratedSlide.illustrations[0].id, 'parcours-carte-admissions');
  const manualCreation = model.slides.find(
    (slide) => slide.procedures[0]?.id === 'creation-manuelle',
  );
  assert.ok(manualCreation.cautions.length > 0);
  const consultation = model.slides.find(
    (slide) => slide.procedures[0]?.id === 'consultation-export',
  );
  assert.equal(consultation.cautions.length, 0);
});

test('reports missing configured references and illustration files', () => {
  const { document, config } = loadPresentationInputs();
  const missingProcedure = clone(config);
  const configuredCardSlide = missingProcedure.slides
    .find((slide) => slide.topicId === 'adherents-cartes' && slide.procedureIds.length > 0);
  configuredCardSlide.procedureIds[0] = 'procedure-absente';
  assert.throws(
    () => buildPresentationModel(document, missingProcedure),
    /procédure introuvable adherents-cartes\/procedure-absente/,
  );

  const missingIllustrationDocument = clone(document);
  const cards = missingIllustrationDocument.topics
    .flatMap((topic) => topic.children ?? [])
    .find((topic) => topic.id === 'adherents-cartes');
  cards.illustrations[0].path = '/assets/documentation/images/absente.svg';
  assert.throws(
    () => buildPresentationModel(missingIllustrationDocument, config),
    /fichier d’illustration introuvable/,
  );
});

test('rejects combinations that could omit selected content', () => {
  const { document, config } = loadPresentationInputs();

  const twoProceduresWithIllustration = clone(config);
  const illustratedSlide = twoProceduresWithIllustration.slides
    .find((slide) => slide.topicId === 'adherents-cartes' && slide.illustrationIds.length > 0);
  illustratedSlide.procedureIds.push('creation-manuelle');
  assert.throws(
    () => buildPresentationModel(document, twoProceduresWithIllustration),
    /deux procédures avec illustration ne sont pas prises en charge/,
  );

  const twoProceduresWithCautions = clone(config);
  const cautionSlide = twoProceduresWithCautions.slides
    .find((slide) => slide.topicId === 'adherents-controles'
      && slide.includeCautions
      && slide.procedureIds.length === 0);
  cautionSlide.procedureIds.push('controles-coherence', 'historique-compte-resultats');
  assert.throws(
    () => buildPresentationModel(document, twoProceduresWithCautions),
    /deux procédures avec précautions ne sont pas prises en charge/,
  );

  const titleWithoutIllustration = clone(config);
  const titledIllustrationSlide = titleWithoutIllustration.slides
    .find((slide) => slide.illustrationSlideTitle);
  titledIllustrationSlide.illustrationIds = [];
  assert.throws(
    () => buildPresentationModel(document, titleWithoutIllustration),
    /illustrationSlideTitle nécessite une illustration/,
  );
});

test('rejects a slide that would require excessive text shrinking', () => {
  const { document, config } = loadPresentationInputs();
  const overloadedDocument = clone(document);
  const cards = overloadedDocument.topics
    .flatMap((topic) => topic.children ?? [])
    .find((topic) => topic.id === 'adherents-cartes');
  const automaticCreation = cards.procedures
    .find((procedure) => procedure.id === 'creation-automatique');
  automaticCreation.steps = ['Contenu volontairement trop long. '.repeat(180)];

  assert.throws(
    () => buildPresentationModel(overloadedDocument, config),
    /diapositive trop chargée.*Répartir le contenu/,
  );
});

test('uses changed JSON text on the next generation', async () => {
  const { document, config } = loadPresentationInputs();
  const changedDocument = clone(document);
  const cards = changedDocument.topics
    .flatMap((topic) => topic.children ?? [])
    .find((topic) => topic.id === 'adherents-cartes');
  const automaticCreation = cards.procedures
    .find((procedure) => procedure.id === 'creation-automatique');
  automaticCreation.steps[0] = 'TEXTE JSON MODIFIÉ POUR LE TEST';

  const model = buildPresentationModel(changedDocument, config);
  const zip = await presentationZip(model);
  const slideXml = await Promise.all(
    Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .map((name) => zip.file(name).async('string')),
  );

  assert.ok(slideXml.join('\n').includes('TEXTE JSON MODIFIÉ POUR LE TEST'));
});

test('creates a traceable PowerPoint with notes and all functional steps', async () => {
  const { document, config } = loadPresentationInputs();
  const model = buildPresentationModel(document, config, PROJECT_ROOT);
  const zip = await presentationZip(model);
  const entries = Object.keys(zip.files);

  assert.ok(entries.includes('[Content_Types].xml'));
  assert.ok(entries.includes('ppt/presentation.xml'));
  assert.equal(
    entries.filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).length,
    model.slides.length + 2,
  );

  const slideXml = (await Promise.all(
    entries
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .map((name) => zip.file(name).async('string')),
  )).join('\n');
  for (const topic of model.openingTopics) {
    assert.ok(slideXml.includes(topic.title), `Titre de rubrique absent du PPTX: ${topic.title}`);
    assert.ok(slideXml.includes(topic.summary), `Résumé absent du PPTX: ${topic.summary}`);
  }
  for (const content of model.slides) {
    for (const procedure of content.procedures) {
      assert.ok(slideXml.includes(procedure.title), `Procédure absente du PPTX: ${procedure.title}`);
      for (const step of procedure.steps) {
        assert.ok(slideXml.includes(step), `Texte absent du PPTX: ${step}`);
      }
    }
    for (const caution of content.cautions) {
      assert.ok(slideXml.includes(caution), `Précaution absente du PPTX: ${caution}`);
    }
    for (const illustration of content.illustrations) {
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

  const notesXml = (await Promise.all(
    entries
      .filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name))
      .map((name) => zip.file(name).async('string')),
  )).join('\n');
  assert.ok(notesXml.includes(`Version documentaire: ${model.documentVersion}`));
  for (const content of model.slides) {
    assert.ok(notesXml.includes(content.topic.id));
    for (const procedure of content.procedures) {
      assert.ok(notesXml.includes(procedure.id));
    }
    for (const illustration of content.illustrations) {
      assert.ok(notesXml.includes(illustration.id));
    }
  }
});
