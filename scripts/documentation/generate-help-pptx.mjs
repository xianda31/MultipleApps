import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pptxgen from 'pptxgenjs';
import { imageSize } from 'image-size';
import { HELP_PPTX_THEME as THEME } from './help-pptx-theme.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
export const CONTENT_PATH = path.join(
  PROJECT_ROOT,
  'projects',
  'admin',
  'src',
  'assets',
  'documentation',
  'back-online-help.json',
);
export const CONFIG_PATH = path.join(SCRIPT_DIR, 'help-pptx.config.json');

const CONTENT_AREA = Object.freeze({
  y: 1.42,
  h: 5.2,
  full: [{ x: 0.55, w: 12.25 }],
  twoColumns: [{ x: 0.55, w: 6.05 }, { x: 6.75, w: 6.05 }],
  withIllustration: [{ x: 0.55, w: 5.7 }],
  withCautions: [{ x: 0.55, w: 8.1 }],
  cautionBox: { x: 8.9, w: 3.9 },
  illustrationBox: { x: 6.55, y: 1.55, w: 6.2, h: 4.95 },
  fullIllustrationBox: { x: 0.7, y: 1.35, w: 11.93, h: 5.45 },
});

export function validateTheme(theme = THEME) {
  if (typeof theme.appIconPath !== 'string' || !theme.appIconPath.trim()) {
    throw new Error('Chemin de l’icône d’application invalide');
  }
  for (const family of ['heading', 'body']) {
    if (typeof theme.fontFamilies?.[family] !== 'string' || !theme.fontFamilies[family].trim()) {
      throw new Error(`Famille de police invalide: ${family}`);
    }
  }
  for (const size of [
    'coverTitle',
    'sectionTitle',
    'slideTitle',
    'procedureTitle',
    'body',
    'compactBody',
    'cautionBody',
    'caption',
    'small',
  ]) {
    if (typeof theme.fontSizes?.[size] !== 'number' || theme.fontSizes[size] <= 0) {
      throw new Error(`Taille de police invalide: ${size}`);
    }
  }
  for (const bodySize of ['body', 'compactBody', 'cautionBody']) {
    if (theme.fontSizes[bodySize] < theme.minimumBodyFontSize) {
      throw new Error(
        `Taille de corps ${bodySize} inférieure au minimum ${theme.minimumBodyFontSize}`,
      );
    }
  }
}

validateTheme();

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Impossible de lire le JSON ${filePath}: ${error.message}`);
  }
}

function flattenTopics(topics) {
  return topics.flatMap((topic) => [topic, ...flattenTopics(topic.children ?? [])]);
}

function hasItems(value) {
  return Array.isArray(value) && value.length > 0;
}

function normalizeContent(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .toLowerCase();
}

function hasPublishableContent(topic) {
  return hasItems(topic.blocks)
    || Boolean(topic.summary?.trim())
    || hasItems(topic.functionalities)
    || hasItems(topic.howTo)
    || hasItems(topic.procedures)
    || hasItems(topic.caution)
    || hasItems(topic.illustrations);
}

function hasDetailedContent(topic) {
  return (topic.blocks ?? []).some(
    (block) => block.type !== 'text' || block.id !== 'introduction',
  )
    || hasItems(topic.functionalities)
    || hasItems(topic.howTo)
    || hasItems(topic.procedures)
    || hasItems(topic.caution)
    || hasItems(topic.illustrations);
}

function requireUniqueIds(items, label, context) {
  const ids = items.map((item) => item.id);
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
  if (duplicate) {
    throw new Error(`${label} dupliqué "${duplicate}" dans ${context}`);
  }
  if (ids.some((id) => !id)) {
    throw new Error(`${label} manquant dans ${context}`);
  }
}

function requireUniqueReferences(ids, label, context) {
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
  if (duplicate) {
    throw new Error(`${label} sélectionné plusieurs fois "${duplicate}" dans ${context}`);
  }
}

function estimateWrappedLineCount(text, width, fontSize) {
  const charactersPerLine = Math.max(18, Math.floor((width * 72) / (fontSize * 0.52)));
  return String(text)
    .split(/\r?\n/)
    .reduce((total, paragraph) => total + Math.max(1, Math.ceil(paragraph.length / charactersPerLine)), 0);
}

function validateTextBlock(text, width, height, fontSize, context) {
  const lines = estimateWrappedLineCount(text, width, fontSize);
  const requiredHeight = lines * ((fontSize * 1.3) / 72);
  if (requiredHeight > height) {
    throw new Error(
      `${context}: texte trop chargé (${requiredHeight.toFixed(2)}" requis, `
      + `${height.toFixed(2)}" disponibles). Répartir le contenu.`,
    );
  }
}

function calculateStepRows(steps, width, height, fontSize, context) {
  if (steps.length === 0) {
    throw new Error(`${context}: aucune étape à afficher`);
  }
  const lineHeight = (fontSize * 1.3) / 72;
  const minimumRows = steps.map((step) => {
    const lines = estimateWrappedLineCount(step, width - 0.36, fontSize);
    return Math.max(0.5, lines * lineHeight + 0.12);
  });
  const maximumGap = 0.16;
  const gap = steps.length > 1 ? maximumGap : 0;
  const requiredHeight = minimumRows.reduce((total, row) => total + row, 0)
    + gap * Math.max(0, steps.length - 1);
  if (requiredHeight > height) {
    throw new Error(
      `${context}: diapositive trop chargée (${requiredHeight.toFixed(2)}" requis, `
      + `${height.toFixed(2)}" disponibles). Répartir le contenu.`,
    );
  }
  return { rowHeights: minimumRows, gap, contentHeight: requiredHeight };
}

function paginateItems(items, width, height, fontSize, context) {
  const pages = [];
  let page = [];

  for (const item of items) {
    const candidate = [...page, item];
    try {
      calculateStepRows(candidate, width, height, fontSize, context);
      page = candidate;
    } catch (error) {
      if (page.length === 0) throw error;
      pages.push(page);
      page = [item];
      calculateStepRows(page, width, height, fontSize, context);
    }
  }

  if (page.length > 0) pages.push(page);
  return pages;
}

function determineSlideLayout(procedures, illustrations, cautions, slideNumber) {
  const context = `Diapositive ${slideNumber}`;
  if (procedures.length === 0) {
    if (illustrations.length === 1 && cautions.length === 0) {
      return 'illustration-only';
    }
    if (cautions.length > 0 && illustrations.length === 0) {
      return 'cautions-only';
    }
    throw new Error(`${context}: au moins une procédure doit être sélectionnée`);
  }
  if (procedures.length > 2) {
    throw new Error(`${context}: plus de deux procédures ne sont pas prises en charge`);
  }
  if (illustrations.length > 1) {
    throw new Error(`${context}: plus d’une illustration n’est pas prise en charge`);
  }
  if (illustrations.length > 0 && cautions.length > 0) {
    throw new Error(`${context}: illustration et précautions ne peuvent pas partager une diapositive`);
  }
  if (procedures.length === 2 && illustrations.length > 0) {
    throw new Error(`${context}: deux procédures avec illustration ne sont pas prises en charge`);
  }
  if (procedures.length === 2 && cautions.length > 0) {
    throw new Error(`${context}: deux procédures avec précautions ne sont pas prises en charge`);
  }
  if (illustrations.length === 1) return 'procedure-with-illustration';
  if (cautions.length > 0) return 'procedure-with-cautions';
  if (procedures.length === 2) return 'two-procedures';
  return 'single-procedure';
}

function procedureFontSize(layout) {
  return layout === 'two-procedures'
    ? THEME.fontSizes.compactBody
    : THEME.fontSizes.body;
}

function contentSlideTitle(content) {
  return content.title
    ?? ((content.procedures ?? []).map((procedure) => procedure.title).join(' / ')
      || 'Points de vigilance');
}

function procedureStepArea(layout) {
  const showTitle = layout === 'two-procedures';
  return showTitle
    ? { showTitle, topOffset: 1.02, heightOffset: 1.22 }
    : { showTitle, topOffset: 0.3, heightOffset: 0.55 };
}

function validateSlideDensity(content, slideNumber) {
  const boxes = content.layout === 'cautions-only' || content.layout === 'illustration-only'
    ? []
    : content.layout === 'two-procedures'
    ? CONTENT_AREA.twoColumns
    : content.layout === 'procedure-with-illustration'
      ? CONTENT_AREA.withIllustration
      : content.layout === 'procedure-with-cautions'
        ? CONTENT_AREA.withCautions
        : CONTENT_AREA.full;
  const fontSize = procedureFontSize(content.layout);
  validateTextBlock(
    contentSlideTitle(content),
    12.1,
    0.52,
    THEME.fontSizes.slideTitle,
    `Diapositive ${slideNumber}, titre`,
  );
  const stepArea = procedureStepArea(content.layout);
  content.procedures.forEach((procedure, index) => {
    if (stepArea.showTitle) {
      validateTextBlock(
        procedure.title,
        boxes[index].w - 0.56,
        0.72,
        THEME.fontSizes.procedureTitle,
        `Diapositive ${slideNumber}, titre de procédure ${procedure.id}`,
      );
    }
    calculateStepRows(
      procedure.steps,
      boxes[index].w - 0.6,
      CONTENT_AREA.h - stepArea.heightOffset,
      fontSize,
      `Diapositive ${slideNumber}, procédure ${procedure.id}`,
    );
  });
  if (content.cautions.length > 0) {
    const cautionWidth = content.layout === 'cautions-only'
      ? CONTENT_AREA.full[0].w - 0.56
      : CONTENT_AREA.cautionBox.w - 0.56;
    const cautionHeightOffset = content.layout === 'cautions-only' ? 0.55 : 1;
    calculateStepRows(
      content.cautions,
      cautionWidth,
      CONTENT_AREA.h - cautionHeightOffset,
      THEME.fontSizes.cautionBody,
      `Diapositive ${slideNumber}, précautions`,
    );
  }
  for (const illustration of content.illustrations) {
    if (illustration.caption) {
      const illustrationBox = content.layout === 'illustration-only'
        ? CONTENT_AREA.fullIllustrationBox
        : CONTENT_AREA.illustrationBox;
      validateTextBlock(
        illustration.caption,
        illustrationBox.w,
        0.42,
        THEME.fontSizes.caption,
        `Diapositive ${slideNumber}, légende ${illustration.id}`,
      );
    }
  }
}

export function resolveIllustrationPath(webPath, projectRoot = PROJECT_ROOT) {
  if (webPath.startsWith('/assets/')) {
    return path.join(projectRoot, 'projects', 'admin', 'src', webPath.slice(1));
  }
  if (webPath.startsWith('/')) {
    return path.join(projectRoot, 'projects', 'admin', 'public', webPath.slice(1));
  }
  throw new Error(`Chemin d’illustration non absolu: ${webPath}`);
}

export function loadPresentationInputs({
  contentPath = CONTENT_PATH,
  configPath = CONFIG_PATH,
} = {}) {
  return {
    document: readJson(contentPath),
    config: readJson(configPath),
  };
}

function createCoverage(document) {
  return {
    documentVersion: document.version,
    included: [],
    planned: [],
    empty: [],
    unsupported: [],
    ambiguities: [],
  };
}

function addExclusion(coverage, category, topic, reason) {
  coverage[category].push({
    id: topic.id,
    title: topic.title,
    reason,
  });
}

function resolveTopicIllustrations(topic, projectRoot, coverage) {
  return (topic.illustrations ?? []).flatMap((illustration) => {
    try {
      const filePath = resolveIllustrationPath(illustration.path, projectRoot);
      if (!fs.existsSync(filePath)) {
        throw new Error(`fichier d’illustration introuvable ${filePath}`);
      }
      return [{ ...illustration, filePath }];
    } catch (error) {
      addExclusion(
        coverage,
        'unsupported',
        topic,
        `Illustration ${illustration.id}: ${error.message}`,
      );
      return [];
    }
  });
}

function blockTextEntries(block) {
  switch (block.type) {
    case 'text':
      return block.paragraphs ?? [];
    case 'list':
      return block.items ?? [];
    case 'procedure':
      return block.steps ?? [];
    case 'attention':
      return block.messages ?? [];
    case 'table':
      return [...(block.columns ?? []), ...(block.rows ?? []).flat()];
    case 'illustration':
      return block.caption ? [block.caption] : [];
    default:
      return [];
  }
}

function reportBlockAmbiguities(topic, coverage) {
  const occurrences = new Map();
  for (const block of topic.blocks ?? []) {
    for (const content of blockTextEntries(block)) {
      const key = normalizeContent(content);
      if (!key) continue;
      const values = occurrences.get(key) ?? [];
      values.push({ blockId: block.id, content });
      occurrences.set(key, values);
    }
  }
  for (const values of occurrences.values()) {
    if (new Set(values.map((value) => value.blockId)).size < 2) continue;
    coverage.ambiguities.push({
      id: topic.id,
      blockIds: values.map((value) => value.blockId),
      content: values[0].content,
      reason: 'Texte identique présent dans plusieurs blocs ; contenu conservé pour relecture.',
    });
  }
}

function listFragmentHeight(items, title, fontSize, context) {
  const { contentHeight } = calculateStepRows(
    items,
    CONTENT_AREA.full[0].w - 0.6,
    4.45,
    fontSize,
    context,
  );
  return Math.max(1.15, contentHeight + (title ? 1.12 : 0.64));
}

function textFragmentHeight(paragraphs, title) {
  const lineHeight = (THEME.fontSizes.body * 1.3) / 72;
  const contentHeight = paragraphs.reduce(
    (height, paragraph) => height
      + estimateWrappedLineCount(
        paragraph,
        CONTENT_AREA.full[0].w - 0.6,
        THEME.fontSizes.body,
      ) * lineHeight
      + 0.12,
    0,
  );
  return Math.max(1.05, contentHeight + (title ? 0.92 : 0.46));
}

function splitParagraphBlock(block, topic) {
  const fragments = [];
  let paragraphs = [];
  for (const paragraph of block.paragraphs ?? []) {
    const candidate = [...paragraphs, paragraph];
    if (textFragmentHeight(candidate, block.title) <= CONTENT_AREA.h) {
      paragraphs = candidate;
      continue;
    }
    if (paragraphs.length === 0) {
      throw new Error(`Bloc ${topic.id}/${block.id}: paragraphe trop long pour une diapositive`);
    }
    fragments.push(paragraphs);
    paragraphs = [paragraph];
  }
  if (paragraphs.length > 0) fragments.push(paragraphs);
  return fragments.map((items, index) => ({
    ...block,
    title: index === 0 ? block.title : block.title ? `${block.title} — suite` : undefined,
    paragraphs: items,
    height: textFragmentHeight(items, block.title),
  }));
}

function splitListBlock(block, topic, field, fontSize) {
  const items = block[field] ?? [];
  const pages = paginateItems(
    items,
    CONTENT_AREA.full[0].w - 0.6,
    4.45,
    fontSize,
    `Bloc ${topic.id}/${block.id}`,
  );
  let itemIndex = 0;
  return pages.map((pageItems, index) => {
    const fragment = {
      ...block,
      title: index === 0 ? block.title : block.title ? `${block.title} — suite` : undefined,
      [field]: pageItems,
      startIndex: itemIndex,
      height: listFragmentHeight(
        pageItems,
        block.title,
        fontSize,
        `Bloc ${topic.id}/${block.id}`,
      ),
    };
    itemIndex += pageItems.length;
    return fragment;
  });
}

function splitTableBlock(block, topic) {
  if (!hasItems(block.columns) || !hasItems(block.rows)) {
    throw new Error(`Bloc ${topic.id}/${block.id}: tableau sans colonnes ou sans lignes`);
  }
  if (block.rows.some((row) => row.length !== block.columns.length)) {
    throw new Error(`Bloc ${topic.id}/${block.id}: nombre de cellules incohérent`);
  }
  const titleHeight = block.title ? 0.55 : 0;
  const rowsPerPage = Math.max(1, Math.floor((CONTENT_AREA.h - titleHeight - 0.65) / 0.48));
  const fragments = [];
  for (let index = 0; index < block.rows.length; index += rowsPerPage) {
    const rows = block.rows.slice(index, index + rowsPerPage);
    fragments.push({
      ...block,
      title: index === 0 ? block.title : block.title ? `${block.title} — suite` : undefined,
      rows,
      height: titleHeight + 0.65 + rows.length * 0.48,
    });
  }
  return fragments;
}

function createBlockFragments(topic, projectRoot, coverage) {
  const illustrationById = new Map(
    resolveTopicIllustrations(topic, projectRoot, coverage)
      .map((illustration) => [illustration.id, illustration]),
  );
  const fragments = [];
  reportBlockAmbiguities(topic, coverage);

  for (const block of topic.blocks ?? []) {
    try {
      switch (block.type) {
        case 'text':
          fragments.push(...splitParagraphBlock(block, topic));
          break;
        case 'list':
          fragments.push(...splitListBlock(block, topic, 'items', THEME.fontSizes.body));
          break;
        case 'procedure':
          fragments.push(...splitListBlock(block, topic, 'steps', THEME.fontSizes.body));
          break;
        case 'attention':
          fragments.push(...splitListBlock(
            block,
            topic,
            'messages',
            THEME.fontSizes.cautionBody,
          ));
          break;
        case 'table':
          fragments.push(...splitTableBlock(block, topic));
          break;
        case 'illustration': {
          const illustration = illustrationById.get(block.illustrationId);
          if (!illustration) {
            throw new Error(`illustration référencée introuvable ${block.illustrationId}`);
          }
          fragments.push({
            ...block,
            illustration: {
              ...illustration,
              caption: block.caption ?? illustration.caption,
            },
            height: CONTENT_AREA.h,
          });
          break;
        }
        default:
          throw new Error(`type de bloc non pris en charge ${block.type}`);
      }
    } catch (error) {
      coverage.unsupported.push({
        id: topic.id,
        title: topic.title,
        blockId: block.id,
        reason: error.message,
      });
    }
  }
  return fragments;
}

function packBlockFragments(topic, chapter, fragments) {
  const pages = [];
  const gap = 0.18;
  let current = [];
  let usedHeight = 0;
  const flush = () => {
    if (current.length === 0) return;
    pages.push({
      kind: 'content',
      topic,
      chapter,
      layout: 'blocks',
      title: pages.length === 0 ? topic.title : `${topic.title} — suite`,
      blocks: current,
    });
    current = [];
    usedHeight = 0;
  };

  for (const fragment of fragments) {
    const standalone = fragment.type === 'illustration' || fragment.height >= CONTENT_AREA.h - 0.1;
    const requiredHeight = fragment.height + (current.length > 0 ? gap : 0);
    if (standalone) {
      flush();
      current = [fragment];
      usedHeight = fragment.height;
      flush();
    } else if (usedHeight + requiredHeight <= CONTENT_AREA.h) {
      current.push(fragment);
      usedHeight += requiredHeight;
    } else {
      flush();
      current = [fragment];
      usedHeight = fragment.height;
    }
  }
  flush();
  return pages;
}

function createTopicPages(topic, chapter, projectRoot, coverage) {
  if (Array.isArray(topic.blocks)) {
    return packBlockFragments(
      topic,
      chapter,
      createBlockFragments(topic, projectRoot, coverage),
    );
  }
  const pages = [];
  const chapterTopic = topic.id === chapter.id;
  const procedureSteps = new Set(
    (topic.procedures ?? [])
      .flatMap((procedure) => procedure.steps ?? [])
      .map(normalizeContent),
  );
  const summaryKey = normalizeContent(topic.summary ?? '');
  const functionalityKeys = new Set();
  const functionalities = (topic.functionalities ?? []).filter((item) => {
    const key = normalizeContent(item);
    if (key && key === summaryKey) {
      coverage.ambiguities.push({
        id: topic.id,
        field: 'functionalities',
        reason: 'Élément identique au résumé, affiché uniquement dans le résumé.',
        content: item,
      });
      return false;
    }
    functionalityKeys.add(key);
    return true;
  });
  const howTo = (topic.howTo ?? []).filter((item) => {
    const key = normalizeContent(item);
    if (!key) return false;
    const duplicateField = key === summaryKey
      ? 'summary'
      : functionalityKeys.has(key)
        ? 'functionalities'
        : procedureSteps.has(key)
          ? 'procedures'
          : undefined;
    if (!duplicateField) return true;
    coverage.ambiguities.push({
      id: topic.id,
      field: 'howTo',
      reason: `Étape identique à ${duplicateField}, affichée une seule fois.`,
      content: item,
    });
    return false;
  });

  const overviewSummary = chapterTopic ? undefined : topic.summary;
  const overviewHeight = overviewSummary ? 2.65 : 4.1;
  const functionalityPages = functionalities.length > 0
    ? paginateItems(
      functionalities,
      CONTENT_AREA.full[0].w - 0.6,
      overviewHeight,
      THEME.fontSizes.body,
      `Rubrique ${topic.id}, fonctionnalités`,
    )
    : [];
  if (overviewSummary || functionalityPages.length > 0) {
    if (functionalityPages.length === 0) {
      pages.push({
        kind: 'content',
        topic,
        chapter,
        layout: 'overview',
        title: topic.title,
        summary: overviewSummary,
        items: [],
        sourceFields: ['summary'],
      });
    } else {
      functionalityPages.forEach((items, index) => {
        pages.push({
          kind: 'content',
          topic,
          chapter,
          layout: 'overview',
          title: index === 0 ? topic.title : `${topic.title} — fonctionnalités (suite)`,
          summary: index === 0 ? overviewSummary : undefined,
          items,
          sourceFields: [
            ...(index === 0 && overviewSummary ? ['summary'] : []),
            'functionalities',
          ],
        });
      });
    }
  }

  const howToPages = howTo.length > 0
    ? paginateItems(
      howTo,
      CONTENT_AREA.full[0].w - 0.6,
      CONTENT_AREA.h - 0.55,
      THEME.fontSizes.body,
      `Rubrique ${topic.id}, parcours conseillé`,
    )
    : [];
  howToPages.forEach((items, index) => {
    pages.push({
      kind: 'content',
      topic,
      chapter,
      layout: 'list-only',
      title: index === 0 ? 'Parcours conseillé' : 'Parcours conseillé — suite',
      items,
      sourceFields: ['howTo'],
    });
  });

  for (const procedure of topic.procedures ?? []) {
    requireUniqueReferences(
      procedure.steps ?? [],
      'Étape de procédure',
      `${topic.id}/${procedure.id}`,
    );
    const stepPages = paginateItems(
      procedure.steps ?? [],
      CONTENT_AREA.full[0].w - 0.6,
      CONTENT_AREA.h - 0.55,
      THEME.fontSizes.body,
      `Rubrique ${topic.id}, procédure ${procedure.id}`,
    );
    stepPages.forEach((steps, index) => {
      pages.push({
        kind: 'content',
        topic,
        chapter,
        layout: 'single-procedure',
        title: index === 0 ? procedure.title : `${procedure.title} — suite`,
        procedures: [{ ...procedure, steps }],
        illustrations: [],
        cautions: [],
        sourceFields: ['procedures'],
      });
    });
  }

  const cautionPages = hasItems(topic.caution)
    ? paginateItems(
      topic.caution,
      CONTENT_AREA.full[0].w - 0.56,
      CONTENT_AREA.h - 0.55,
      THEME.fontSizes.cautionBody,
      `Rubrique ${topic.id}, précautions`,
    )
    : [];
  cautionPages.forEach((cautions, index) => {
    pages.push({
      kind: 'content',
      topic,
      chapter,
      layout: 'cautions-only',
      title: index === 0 ? 'Points de vigilance' : 'Points de vigilance — suite',
      procedures: [],
      illustrations: [],
      cautions,
      sourceFields: ['caution'],
    });
  });

  resolveTopicIllustrations(topic, projectRoot, coverage).forEach((illustration, index) => {
    pages.push({
      kind: 'content',
      topic,
      chapter,
      layout: 'illustration-only',
      title: `${topic.title} — illustration${topic.illustrations.length > 1 ? ` ${index + 1}` : ''}`,
      procedures: [],
      illustrations: [illustration],
      cautions: [],
      sourceFields: ['illustrations'],
    });
  });

  return pages;
}

function buildCompletePresentationModel(document, config, projectRoot) {
  const coverage = createCoverage(document);
  const pages = [];
  const allTopics = flattenTopics(document.topics);
  requireUniqueIds(allTopics, 'Identifiant de rubrique', 'la base documentaire');

  const visitTopic = (topic, chapter) => {
    if (topic.contentStatus === 'planned') {
      addExclusion(
        coverage,
        'planned',
        topic,
        hasDetailedContent(topic)
          ? 'Rubrique explicitement planifiée, exclue du manuel publié.'
          : 'Rubrique explicitement planifiée et sans contenu publiable.',
      );
      for (const child of topic.children ?? []) visitTopic(child, chapter);
      return;
    }
    if (!hasPublishableContent(topic)) {
      addExclusion(coverage, 'empty', topic, 'Aucun contenu documentaire publiable.');
      for (const child of topic.children ?? []) visitTopic(child, chapter);
      return;
    }

    const topicPages = createTopicPages(topic, chapter, projectRoot, coverage);
    if (topicPages.length === 0) {
      addExclusion(
        coverage,
        'unsupported',
        topic,
        'Aucun champ compatible n’a pu être restitué.',
      );
    } else {
      coverage.included.push({
        id: topic.id,
        title: topic.title,
        chapterId: chapter.id,
      });
      pages.push(...topicPages);
    }
    for (const child of topic.children ?? []) visitTopic(child, chapter);
  };

  for (const chapter of document.topics) {
    if (chapter.contentStatus === 'planned') {
      visitTopic(chapter, chapter);
      continue;
    }
    if (!hasPublishableContent(chapter)) {
      visitTopic(chapter, chapter);
      continue;
    }
    const childTopics = (chapter.children ?? []).filter(
      (topic) => topic.contentStatus !== 'planned' && hasPublishableContent(topic),
    );
    const childTitlePages = childTopics.length > 0
      ? paginateItems(
        childTopics.map((topic) => topic.title),
        11.25,
        3.9,
        THEME.fontSizes.compactBody,
        `Ouverture ${chapter.id}`,
      )
      : [[]];
    let childIndex = 0;
    childTitlePages.forEach((titles, index) => {
      pages.push({
        kind: 'chapter',
        topic: chapter,
        title: index === 0 ? chapter.title : `${chapter.title} — suite`,
        childTopics: childTopics.slice(childIndex, childIndex + titles.length),
      });
      childIndex += titles.length;
    });
    visitTopic(chapter, chapter);
  }

  coverage.totals = {
    topics: allTopics.length,
    included: coverage.included.length,
    planned: coverage.planned.length,
    empty: coverage.empty.length,
    unsupported: coverage.unsupported.length,
    ambiguities: coverage.ambiguities.length,
  };

  return {
    documentVersion: document.version,
    presentationTitle: config.presentationTitle,
    presentationSubtitle: config.presentationSubtitle,
    outputPath: path.resolve(projectRoot, config.outputPath),
    coverageReportPath: path.resolve(projectRoot, config.coverageReportPath),
    pages,
    coverage,
  };
}

export function buildPresentationModel(document, config, projectRoot = PROJECT_ROOT) {
  if (!document.version || !Array.isArray(document.topics)) {
    throw new Error('La base documentaire doit contenir une version et des rubriques');
  }
  if (config.includePublishedTopics === true) {
    if (!config.coverageReportPath) {
      throw new Error('coverageReportPath est obligatoire pour le manuel complet');
    }
    return buildCompletePresentationModel(document, config, projectRoot);
  }
  const allTopics = flattenTopics(document.topics);
  requireUniqueIds(allTopics, 'Identifiant de rubrique', 'la base documentaire');
  const topicById = new Map(allTopics.map((topic) => [topic.id, topic]));

  const openingTopics = config.topicIds.map((topicId) => {
    const topic = topicById.get(topicId);
    if (!topic) throw new Error(`Rubrique introuvable dans la configuration: ${topicId}`);
    return topic;
  });
  openingTopics.forEach((topic) => {
    validateTextBlock(
      topic.summary,
      10.9,
      0.62,
      THEME.fontSizes.body,
      `Ouverture, résumé ${topic.id}`,
    );
  });

  const configuredSlides = config.slides.map((slideConfig, index) => {
    if (!Array.isArray(slideConfig.procedureIds) || !Array.isArray(slideConfig.illustrationIds)) {
      throw new Error(
        `Diapositive ${index + 1}: procedureIds et illustrationIds doivent être des tableaux`,
      );
    }
    requireUniqueReferences(
      slideConfig.procedureIds,
      'Procédure',
      `la diapositive ${index + 1}`,
    );
    requireUniqueReferences(
      slideConfig.illustrationIds,
      'Illustration',
      `la diapositive ${index + 1}`,
    );
    const topic = topicById.get(slideConfig.topicId);
    if (!topic) {
      throw new Error(`Diapositive ${index + 1}: rubrique introuvable ${slideConfig.topicId}`);
    }

    const procedures = topic.procedures ?? [];
    requireUniqueIds(procedures, 'Identifiant de procédure', topic.id);
    const procedureById = new Map(procedures.map((procedure) => [procedure.id, procedure]));
    const selectedProcedures = slideConfig.procedureIds.map((procedureId) => {
      const procedure = procedureById.get(procedureId);
      if (!procedure) {
        throw new Error(`Diapositive ${index + 1}: procédure introuvable ${topic.id}/${procedureId}`);
      }
      return procedure;
    });

    const illustrations = topic.illustrations ?? [];
    requireUniqueIds(illustrations, 'Identifiant d’illustration', topic.id);
    const illustrationById = new Map(illustrations.map((illustration) => [illustration.id, illustration]));
    const selectedIllustrations = slideConfig.illustrationIds.map((illustrationId) => {
      const illustration = illustrationById.get(illustrationId);
      if (!illustration) {
        throw new Error(`Diapositive ${index + 1}: illustration introuvable ${topic.id}/${illustrationId}`);
      }
      const filePath = resolveIllustrationPath(illustration.path, projectRoot);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Diapositive ${index + 1}: fichier d’illustration introuvable ${filePath}`);
      }
      return { ...illustration, filePath };
    });

    const cautions = slideConfig.includeCautions ? (topic.caution ?? []) : [];
    if (slideConfig.includeCautions && cautions.length === 0) {
      throw new Error(`Diapositive ${index + 1}: aucune précaution disponible pour ${topic.id}`);
    }
    const content = {
      topic,
      title: slideConfig.slideTitle,
      procedures: selectedProcedures,
      illustrations: selectedIllustrations,
      cautions,
      illustrationSlideTitle: slideConfig.illustrationSlideTitle,
      layout: determineSlideLayout(
        selectedProcedures,
        selectedIllustrations,
        cautions,
        index + 1,
      ),
    };
    if (content.illustrationSlideTitle && selectedIllustrations.length === 0) {
      throw new Error(
        `Diapositive ${index + 1}: illustrationSlideTitle nécessite une illustration`,
      );
    }
    return content;
  });
  const slides = configuredSlides.flatMap((content) => {
    if (content.layout !== 'procedure-with-illustration') {
      return content;
    }
    const procedure = content.procedures[0];
    const illustration = content.illustrations[0];
    return [
      {
        ...content,
        illustrations: [],
        layout: 'single-procedure',
        traceIllustrationIds: [illustration.id],
      },
      {
        ...content,
        title: content.illustrationSlideTitle ?? `${procedure.title} — schéma explicatif`,
        procedures: [],
        cautions: [],
        layout: 'illustration-only',
        traceProcedureIds: [procedure.id],
      },
    ];
  });
  slides.forEach((content, index) => validateSlideDensity(content, index + 1));

  return {
    documentVersion: document.version,
    presentationTitle: config.presentationTitle,
    presentationSubtitle: config.presentationSubtitle,
    sectionTitle: config.sectionTitle,
    outputPath: path.resolve(projectRoot, config.outputPath),
    openingTopics,
    slides,
  };
}

function addText(slide, text, options = {}) {
  slide.addText(text, {
    fontFace: THEME.fontFamilies.body,
    color: THEME.colors.text,
    margin: 0,
    breakLine: false,
    valign: 'mid',
    ...options,
  });
}

function addFooter(slide, pageNumber, version, appIconPath) {
  slide.addShape('line', {
    x: 0.4,
    y: 6.96,
    w: 12.53,
    h: 0,
    line: { color: THEME.colors.border, width: 1 },
  });
  slide.addImage({
    path: appIconPath,
    x: 0.42,
    y: 7.01,
    w: 0.32,
    h: 0.32,
    altText: 'Icône de l’application BCSTO',
  });
  addText(slide, `Documentation ${version}`, {
    x: 0.86,
    y: 7.04,
    w: 3.2,
    h: 0.28,
    fontSize: THEME.fontSizes.small,
    color: THEME.colors.muted,
  });
  addText(slide, String(pageNumber), {
    x: 12.2,
    y: 7.04,
    w: 0.7,
    h: 0.28,
    align: 'right',
    fontSize: THEME.fontSizes.small,
    color: THEME.colors.muted,
  });
}

function addHeader(slide, title, topicTitle) {
  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: THEME.width,
    h: 0.16,
    line: { color: THEME.colors.green, transparency: 100 },
    fill: { color: THEME.colors.green },
  });
  addText(slide, title, {
    x: 0.55,
    y: 0.38,
    w: 12.1,
    h: 0.52,
    fontFace: THEME.fontFamilies.heading,
    fontSize: THEME.fontSizes.slideTitle,
    bold: true,
    color: THEME.colors.title,
    align: 'left',
  });
  addText(slide, topicTitle, {
    x: 0.57,
    y: 0.94,
    w: 11.8,
    h: 0.28,
    fontSize: 11,
    color: THEME.colors.greenDark,
  });
}

function addStepList(slide, steps, x, y, w, h, fontSize, context) {
  const { rowHeights, gap } = calculateStepRows(steps, w, h, fontSize, context);
  let top = y;
  steps.forEach((step, index) => {
    const rowHeight = rowHeights[index];
    slide.addShape('ellipse', {
      x,
      y: top + 0.12,
      w: 0.22,
      h: 0.22,
      line: { color: THEME.colors.green, transparency: 100 },
      fill: { color: THEME.colors.green },
    });
    addText(slide, step, {
      x: x + 0.36,
      y: top,
      w: w - 0.36,
      h: rowHeight - 0.03,
      fontSize,
      valign: 'top',
      breakLine: true,
    });
    top += rowHeight + gap;
  });
}

function addProcedureCard(
  slide,
  procedure,
  x,
  y,
  w,
  h,
  fontSize,
  slideNumber,
  showTitle,
) {
  const stepArea = procedureStepArea(showTitle ? 'two-procedures' : 'single-procedure');
  const { contentHeight } = calculateStepRows(
    procedure.steps,
    w - 0.6,
    h - stepArea.heightOffset,
    fontSize,
    `Diapositive ${slideNumber}, procédure ${procedure.id}`,
  );
  const cardHeight = Math.min(
    h,
    Math.max(showTitle ? 1.8 : 1.25, stepArea.topOffset + contentHeight + 0.3),
  );
  slide.addShape('roundRect', {
    x,
    y,
    w,
    h: cardHeight,
    rectRadius: 0.08,
    line: { color: THEME.colors.border, width: 1 },
    fill: { color: THEME.colors.background },
  });
  slide.addShape('rect', {
    x,
    y: y + 0.14,
    w: 0.07,
    h: cardHeight - 0.28,
    line: { color: THEME.colors.green, transparency: 100 },
    fill: { color: THEME.colors.green },
  });
  if (showTitle) {
    addText(slide, procedure.title, {
      x: x + 0.28,
      y: y + 0.2,
      w: w - 0.56,
      h: 0.72,
      fontFace: THEME.fontFamilies.heading,
      fontSize: THEME.fontSizes.procedureTitle,
      bold: true,
      color: THEME.colors.greenDark,
    });
  }
  addStepList(
    slide,
    procedure.steps,
    x + 0.3,
    y + stepArea.topOffset,
    w - 0.6,
    cardHeight - stepArea.heightOffset,
    fontSize,
    `Diapositive ${slideNumber}, procédure ${procedure.id}`,
  );
}

export function calculateImageContainBox(filePath, x, y, w, h) {
  const dimensions = imageSize(filePath);
  if (!dimensions.width || !dimensions.height) {
    throw new Error(`Dimensions intrinsèques introuvables pour l’illustration ${filePath}`);
  }
  const scale = Math.min(w / dimensions.width, h / dimensions.height);
  const targetWidth = dimensions.width * scale;
  const targetHeight = dimensions.height * scale;
  return {
    x: x + (w - targetWidth) / 2,
    y: y + (h - targetHeight) / 2,
    w: targetWidth,
    h: targetHeight,
  };
}

function addIllustration(slide, illustration, x, y, w, h) {
  const captionHeight = illustration.caption ? 0.9 : 0;
  const availableHeight = h - captionHeight - 0.08;
  const box = calculateImageContainBox(
    illustration.filePath,
    x,
    y,
    w,
    availableHeight,
  );
  slide.addImage({
    path: illustration.filePath,
    ...box,
    altText: illustration.alt,
  });
  if (illustration.caption) {
    addText(slide, illustration.caption, {
      x,
      y: y + h - captionHeight,
      w,
      h: captionHeight,
      align: 'center',
      italic: true,
      fontSize: THEME.fontSizes.caption,
      color: THEME.colors.muted,
    });
  }
}

function addCautions(slide, cautions, x, y, w, h, showTitle = true) {
  const heightOffset = showTitle ? 1 : 0.55;
  const { contentHeight } = calculateStepRows(
    cautions,
    w - 0.56,
    h - heightOffset,
    THEME.fontSizes.cautionBody,
    'Précautions',
  );
  const cardHeight = Math.min(
    h,
    Math.max(showTitle ? 1.8 : 1.25, (showTitle ? 0.78 : 0.3) + contentHeight + 0.3),
  );
  slide.addShape('roundRect', {
    x,
    y,
    w,
    h: cardHeight,
    line: { color: 'E5C56C', width: 1 },
    fill: { color: THEME.colors.background },
  });
  slide.addShape('rect', {
    x,
    y: y + 0.14,
    w: 0.07,
    h: cardHeight - 0.28,
    line: { color: 'D9A514', transparency: 100 },
    fill: { color: 'D9A514' },
  });
  if (showTitle) {
    addText(slide, 'Points de vigilance', {
      x: x + 0.25,
      y: y + 0.2,
      w: w - 0.5,
      h: 0.4,
      bold: true,
      fontSize: THEME.fontSizes.procedureTitle,
      color: '7A5700',
    });
  }
  addStepList(
    slide,
    cautions,
    x + 0.28,
    y + (showTitle ? 0.78 : 0.3),
    w - 0.56,
    cardHeight - heightOffset,
    THEME.fontSizes.cautionBody,
    'Précautions',
  );
}

function addListCard(slide, title, items, x, y, w, h, fontSize, context) {
  const titleOffset = title ? 0.78 : 0.3;
  const { contentHeight } = calculateStepRows(
    items,
    w - 0.6,
    h - titleOffset - 0.3,
    fontSize,
    context,
  );
  const cardHeight = Math.min(h, Math.max(1.25, titleOffset + contentHeight + 0.3));
  slide.addShape('roundRect', {
    x,
    y,
    w,
    h: cardHeight,
    line: { color: THEME.colors.border, width: 1 },
    fill: { color: THEME.colors.background },
  });
  slide.addShape('rect', {
    x,
    y: y + 0.14,
    w: 0.07,
    h: cardHeight - 0.28,
    line: { color: THEME.colors.green, transparency: 100 },
    fill: { color: THEME.colors.green },
  });
  if (title) {
    addText(slide, title, {
      x: x + 0.28,
      y: y + 0.2,
      w: w - 0.56,
      h: 0.4,
      bold: true,
      fontSize: THEME.fontSizes.procedureTitle,
      color: THEME.colors.greenDark,
    });
  }
  addStepList(
    slide,
    items,
    x + 0.3,
    y + titleOffset,
    w - 0.6,
    cardHeight - titleOffset - 0.15,
    fontSize,
    context,
  );
}

function addTextFragment(slide, block, x, y, w, h) {
  slide.addShape('roundRect', {
    x,
    y,
    w,
    h,
    line: { color: THEME.colors.border, width: 1 },
    fill: { color: THEME.colors.background },
  });
  const titleOffset = block.title ? 0.72 : 0.24;
  if (block.title) {
    addText(slide, block.title, {
      x: x + 0.28,
      y: y + 0.18,
      w: w - 0.56,
      h: 0.38,
      bold: true,
      fontSize: THEME.fontSizes.procedureTitle,
      color: THEME.colors.greenDark,
    });
  }
  addText(slide, block.paragraphs.join('\n\n'), {
    x: x + 0.3,
    y: y + titleOffset,
    w: w - 0.6,
    h: h - titleOffset - 0.18,
    fontSize: THEME.fontSizes.body,
    valign: 'top',
    breakLine: true,
  });
}

function addNumberedFragment(slide, block, x, y, w, h, pageNumber) {
  const titleOffset = block.title ? 0.78 : 0.3;
  slide.addShape('roundRect', {
    x,
    y,
    w,
    h,
    line: { color: THEME.colors.border, width: 1 },
    fill: { color: THEME.colors.background },
  });
  if (block.title) {
    addText(slide, block.title, {
      x: x + 0.28,
      y: y + 0.2,
      w: w - 0.56,
      h: 0.4,
      bold: true,
      fontSize: THEME.fontSizes.procedureTitle,
      color: THEME.colors.greenDark,
    });
  }
  const { rowHeights, gap } = calculateStepRows(
    block.steps,
    w - 0.6,
    h - titleOffset - 0.3,
    THEME.fontSizes.body,
    `Diapositive ${pageNumber}, bloc ${block.id}`,
  );
  let top = y + titleOffset;
  block.steps.forEach((step, index) => {
    const rowHeight = rowHeights[index];
    slide.addShape('ellipse', {
      x: x + 0.28,
      y: top + 0.08,
      w: 0.3,
      h: 0.3,
      line: { color: THEME.colors.green, transparency: 100 },
      fill: { color: THEME.colors.green },
    });
    addText(slide, String((block.startIndex ?? 0) + index + 1), {
      x: x + 0.28,
      y: top + 0.08,
      w: 0.3,
      h: 0.3,
      align: 'center',
      bold: true,
      fontSize: 10,
      color: 'FFFFFF',
    });
    addText(slide, step, {
      x: x + 0.7,
      y: top,
      w: w - 0.98,
      h: rowHeight,
      fontSize: THEME.fontSizes.body,
      valign: 'top',
      breakLine: true,
    });
    top += rowHeight + gap;
  });
}

function addAttentionFragment(slide, block, x, y, w, h, pageNumber) {
  const titleOffset = block.title ? 0.78 : 0.3;
  slide.addShape('roundRect', {
    x,
    y,
    w,
    h,
    line: { color: 'E5C56C', width: 1 },
    fill: { color: THEME.colors.background },
  });
  slide.addShape('rect', {
    x,
    y: y + 0.14,
    w: 0.07,
    h: h - 0.28,
    line: { color: 'D9A514', transparency: 100 },
    fill: { color: 'D9A514' },
  });
  if (block.title) {
    addText(slide, block.title, {
      x: x + 0.28,
      y: y + 0.2,
      w: w - 0.56,
      h: 0.4,
      bold: true,
      fontSize: THEME.fontSizes.procedureTitle,
      color: '7A5700',
    });
  }
  addStepList(
    slide,
    block.messages,
    x + 0.3,
    y + titleOffset,
    w - 0.6,
    h - titleOffset - 0.15,
    THEME.fontSizes.cautionBody,
    `Diapositive ${pageNumber}, bloc ${block.id}`,
  );
}

function addTableFragment(slide, block, x, y, w) {
  let tableY = y;
  if (block.title) {
    addText(slide, block.title, {
      x,
      y,
      w,
      h: 0.4,
      bold: true,
      fontSize: THEME.fontSizes.procedureTitle,
      color: THEME.colors.greenDark,
    });
    tableY += 0.5;
  }
  const rows = [
    block.columns.map((column) => ({
      text: column,
      options: { bold: true, fill: 'EEF5F0' },
    })),
    ...block.rows.map((row) => row.map((cell) => ({ text: cell }))),
  ];
  slide.addTable(rows, {
    x,
    y: tableY,
    w,
    colW: Array(block.columns.length).fill(w / block.columns.length),
    rowH: 0.42,
    border: { type: 'solid', color: THEME.colors.border, pt: 1 },
    color: THEME.colors.text,
    fill: THEME.colors.background,
    fontFace: THEME.fontFamilies.body,
    fontSize: 14,
    margin: 0.06,
    valign: 'mid',
  });
}

function addBlocksPage(slide, content, pageNumber) {
  const box = CONTENT_AREA.full[0];
  const gap = 0.18;
  let top = CONTENT_AREA.y;
  for (const block of content.blocks) {
    switch (block.type) {
      case 'text':
        addTextFragment(slide, block, box.x, top, box.w, block.height);
        break;
      case 'list':
        addListCard(
          slide,
          block.title,
          block.items,
          box.x,
          top,
          box.w,
          block.height,
          THEME.fontSizes.body,
          `Diapositive ${pageNumber}, bloc ${block.id}`,
        );
        break;
      case 'procedure':
        addNumberedFragment(slide, block, box.x, top, box.w, block.height, pageNumber);
        break;
      case 'attention':
        addAttentionFragment(slide, block, box.x, top, box.w, block.height, pageNumber);
        break;
      case 'table':
        addTableFragment(slide, block, box.x, top, box.w);
        break;
      case 'illustration':
        addIllustration(slide, block.illustration, box.x, top, box.w, block.height);
        break;
      default:
        throw new Error(`Diapositive ${pageNumber}: bloc non pris en charge ${block.type}`);
    }
    top += block.height + gap;
  }
}

function addOverview(slide, content, pageNumber) {
  const box = CONTENT_AREA.full[0];
  let top = CONTENT_AREA.y;
  if (content.summary) {
    validateTextBlock(
      content.summary,
      box.w - 0.6,
      1.05,
      THEME.fontSizes.body,
      `Diapositive ${pageNumber}, résumé`,
    );
    slide.addShape('roundRect', {
      x: box.x,
      y: top,
      w: box.w,
      h: 1.25,
      line: { color: THEME.colors.border, width: 1 },
      fill: { color: THEME.colors.background },
    });
    addText(slide, content.summary, {
      x: box.x + 0.3,
      y: top + 0.18,
      w: box.w - 0.6,
      h: 0.9,
      fontSize: THEME.fontSizes.body,
      valign: 'top',
      breakLine: true,
    });
    top += 1.45;
  }
  if (content.items.length > 0) {
    addListCard(
      slide,
      'Fonctionnalités',
      content.items,
      box.x,
      top,
      box.w,
      CONTENT_AREA.y + CONTENT_AREA.h - top,
      THEME.fontSizes.body,
      `Diapositive ${pageNumber}, fonctionnalités`,
    );
  }
}

function addChapterOpening(pptx, model, content, pageNumber, appIconPath) {
  const slide = pptx.addSlide();
  slide.background = { color: THEME.colors.background };
  addText(slide, content.title, {
    x: 0.65,
    y: 0.72,
    w: 11.8,
    h: 0.7,
    fontFace: THEME.fontFamilies.heading,
    fontSize: THEME.fontSizes.sectionTitle,
    bold: true,
    color: THEME.colors.title,
  });
  if (content.summary) {
    addText(slide, content.summary, {
      x: 0.75,
      y: 1.62,
      w: 11.8,
      h: 1.05,
      fontSize: THEME.fontSizes.body,
      valign: 'top',
      breakLine: true,
    });
  }
  if (content.childTopics.length > 0) {
    const listY = content.summary ? 2.8 : 1.6;
    addListCard(
      slide,
      'Rubriques du chapitre',
      content.childTopics.map((topic) => topic.title),
      0.75,
      listY,
      11.85,
      6.55 - listY,
      THEME.fontSizes.compactBody,
      `Ouverture ${content.topic.id}`,
    );
  }
  addFooter(slide, pageNumber, model.documentVersion, appIconPath);
  addTraceNotes(slide, model.documentVersion, [content.topic.id], [], [], ['navigation']);
}

function addTraceNotes(
  slide,
  version,
  topicIds = [],
  procedureIds = [],
  illustrationIds = [],
  sourceFields = [],
  blockIds = [],
) {
  slide.addNotes([
    `Version documentaire: ${version}`,
    `Rubriques: ${topicIds.join(', ') || 'aucune'}`,
    `Procédures: ${procedureIds.join(', ') || 'aucune'}`,
    `Illustrations: ${illustrationIds.join(', ') || 'aucune'}`,
    `Champs: ${sourceFields.join(', ') || 'aucun'}`,
    `Blocs: ${blockIds.join(', ') || 'aucun'}`,
  ].join('\n'));
}

function addCover(pptx, model, appIconPath) {
  const slide = pptx.addSlide();
  slide.background = { color: THEME.colors.background };
  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: 0.18,
    h: THEME.height,
    line: { color: THEME.colors.green, transparency: 100 },
    fill: { color: THEME.colors.green },
  });
  slide.addImage({
    path: appIconPath,
    x: 0.75,
    y: 0.7,
    w: 1.4,
    h: 1.4,
    altText: 'Icône de l’application BCSTO',
  });
  addText(slide, model.presentationTitle, {
    x: 0.75,
    y: 2.45,
    w: 10.8,
    h: 1.15,
    fontFace: THEME.fontFamilies.heading,
    fontSize: THEME.fontSizes.coverTitle,
    bold: true,
    color: THEME.colors.title,
  });
  addText(slide, model.presentationSubtitle, {
    x: 0.78,
    y: 3.7,
    w: 9.8,
    h: 0.55,
    fontSize: 19,
    color: THEME.colors.greenDark,
  });
  addText(slide, `Version documentaire ${model.documentVersion}`, {
    x: 0.78,
    y: 6.45,
    w: 5.4,
    h: 0.4,
    fontSize: 12,
    color: THEME.colors.muted,
  });
  addTraceNotes(slide, model.documentVersion);
}

function addOpening(pptx, model, pageNumber, appIconPath) {
  const slide = pptx.addSlide();
  slide.background = { color: THEME.colors.background };
  addText(slide, model.sectionTitle, {
    x: 0.65,
    y: 0.72,
    w: 11.8,
    h: 0.7,
    fontFace: THEME.fontFamilies.heading,
    fontSize: THEME.fontSizes.sectionTitle,
    bold: true,
    color: THEME.colors.title,
  });
  const gap = 0.22;
  const availableHeight = 5.05;
  const cardHeight = Math.min(
    1.65,
    (availableHeight - gap * Math.max(0, model.openingTopics.length - 1))
      / model.openingTopics.length,
  );
  if (cardHeight < 1.35) {
    throw new Error(
      `Ouverture: ${model.openingTopics.length} rubriques ne tiennent pas lisiblement sur une diapositive`,
    );
  }
  model.openingTopics.forEach((topic, index) => {
    const y = 1.55 + index * (cardHeight + gap);
    slide.addShape('roundRect', {
      x: 0.75,
      y,
      w: 11.85,
      h: cardHeight,
      line: { color: THEME.colors.border, width: 1 },
      fill: { color: THEME.colors.background },
    });
    slide.addShape('rect', {
      x: 0.75,
      y: y + 0.12,
      w: 0.07,
      h: cardHeight - 0.24,
      line: { color: THEME.colors.green, transparency: 100 },
      fill: { color: THEME.colors.green },
    });
    addText(slide, topic.title, {
      x: 1.05,
      y: y + 0.22,
      w: 3.4,
      h: 0.42,
      fontFace: THEME.fontFamilies.heading,
      fontSize: 21,
      bold: true,
      color: THEME.colors.greenDark,
    });
    addText(slide, topic.summary, {
      x: 1.05,
      y: y + 0.72,
      w: 10.9,
      h: cardHeight - 0.88,
      fontSize: THEME.fontSizes.body,
      breakLine: true,
    });
  });
  addFooter(slide, pageNumber, model.documentVersion, appIconPath);
  addTraceNotes(slide, model.documentVersion, model.openingTopics.map((topic) => topic.id));
}

function addContentSlide(pptx, model, content, pageNumber, appIconPath) {
  const slide = pptx.addSlide();
  slide.background = { color: THEME.colors.background };
  const title = contentSlideTitle(content);
  addHeader(slide, title, content.chapter?.title ?? content.topic.title);

  if (content.layout === 'blocks') {
    addBlocksPage(slide, content, pageNumber);
    addFooter(slide, pageNumber, model.documentVersion, appIconPath);
    addTraceNotes(
      slide,
      model.documentVersion,
      [content.topic.id],
      content.blocks
        .filter((block) => block.type === 'procedure')
        .map((block) => block.id),
      content.blocks
        .filter((block) => block.type === 'illustration')
        .map((block) => block.illustrationId),
      ['blocks'],
      content.blocks.map((block) => block.id),
    );
    return;
  }

  if (content.layout === 'overview') {
    addOverview(slide, content, pageNumber);
    addFooter(slide, pageNumber, model.documentVersion, appIconPath);
    addTraceNotes(
      slide,
      model.documentVersion,
      [content.topic.id],
      [],
      [],
      content.sourceFields,
    );
    return;
  }
  if (content.layout === 'list-only') {
    const box = CONTENT_AREA.full[0];
    addListCard(
      slide,
      undefined,
      content.items,
      box.x,
      CONTENT_AREA.y,
      box.w,
      CONTENT_AREA.h,
      THEME.fontSizes.body,
      `Diapositive ${pageNumber}, ${content.sourceFields.join(', ')}`,
    );
    addFooter(slide, pageNumber, model.documentVersion, appIconPath);
    addTraceNotes(
      slide,
      model.documentVersion,
      [content.topic.id],
      [],
      [],
      content.sourceFields,
    );
    return;
  }

  const verifiedLayout = determineSlideLayout(
    content.procedures ?? [],
    content.illustrations ?? [],
    content.cautions ?? [],
    pageNumber,
  );
  if (verifiedLayout !== content.layout) {
    throw new Error(`Diapositive ${pageNumber}: disposition incohérente ${content.layout}`);
  }
  const fontSize = procedureFontSize(content.layout);

  switch (content.layout) {
    case 'procedure-with-illustration': {
      const box = CONTENT_AREA.withIllustration[0];
      addProcedureCard(
        slide,
        content.procedures[0],
        box.x,
        CONTENT_AREA.y,
        box.w,
        CONTENT_AREA.h,
        fontSize,
        pageNumber,
        false,
      );
      addIllustration(
        slide,
        content.illustrations[0],
        CONTENT_AREA.illustrationBox.x,
        CONTENT_AREA.illustrationBox.y,
        CONTENT_AREA.illustrationBox.w,
        CONTENT_AREA.illustrationBox.h,
      );
      break;
    }
    case 'procedure-with-cautions': {
      const box = CONTENT_AREA.withCautions[0];
      addProcedureCard(
        slide,
        content.procedures[0],
        box.x,
        CONTENT_AREA.y,
        box.w,
        CONTENT_AREA.h,
        fontSize,
        pageNumber,
        false,
      );
      addCautions(
        slide,
        content.cautions,
        CONTENT_AREA.cautionBox.x,
        CONTENT_AREA.y,
        CONTENT_AREA.cautionBox.w,
        CONTENT_AREA.h,
        true,
      );
      break;
    }
    case 'two-procedures':
      content.procedures.forEach((procedure, index) => {
        const box = CONTENT_AREA.twoColumns[index];
        addProcedureCard(
          slide,
          procedure,
          box.x,
          CONTENT_AREA.y,
          box.w,
          CONTENT_AREA.h,
          fontSize,
          pageNumber,
          true,
        );
      });
      break;
    case 'single-procedure': {
      const box = CONTENT_AREA.full[0];
      addProcedureCard(
        slide,
        content.procedures[0],
        box.x,
        CONTENT_AREA.y,
        box.w,
        CONTENT_AREA.h,
        fontSize,
        pageNumber,
        false,
      );
      break;
    }
    case 'illustration-only': {
      const box = CONTENT_AREA.fullIllustrationBox;
      addIllustration(
        slide,
        content.illustrations[0],
        box.x,
        box.y,
        box.w,
        box.h,
      );
      break;
    }
    case 'cautions-only': {
      const box = CONTENT_AREA.full[0];
      addCautions(
        slide,
        content.cautions,
        box.x,
        CONTENT_AREA.y,
        box.w,
        CONTENT_AREA.h,
        false,
      );
      break;
    }
    default:
      throw new Error(`Diapositive ${pageNumber}: disposition non prise en charge ${content.layout}`);
  }

  addFooter(slide, pageNumber, model.documentVersion, appIconPath);
  addTraceNotes(
    slide,
    model.documentVersion,
    [content.topic.id],
    content.traceProcedureIds
      ?? (content.procedures ?? []).map((procedure) => procedure.id),
    content.traceIllustrationIds
      ?? (content.illustrations ?? []).map((illustration) => illustration.id),
    content.sourceFields ?? [],
  );
}

export function createPresentation(model) {
  const appIconPath = path.resolve(PROJECT_ROOT, THEME.appIconPath);
  if (!fs.existsSync(appIconPath)) {
    throw new Error(`Icône de l’application BCSTO introuvable: ${appIconPath}`);
  }

  const pptx = new pptxgen();
  pptx.layout = THEME.layout;
  pptx.author = 'BCSTO';
  pptx.company = 'Bridge Club Saint-Orens';
  pptx.subject = `Documentation commune ${model.documentVersion}`;
  pptx.title = model.presentationTitle;
  pptx.lang = 'fr-FR';
  pptx.theme = {
    headFontFace: THEME.fontFamilies.heading,
    bodyFontFace: THEME.fontFamilies.body,
    lang: 'fr-FR',
  };

  addCover(pptx, model, appIconPath);
  if (model.pages) {
    model.pages.forEach((content, index) => {
      const pageNumber = index + 2;
      if (content.kind === 'chapter') {
        addChapterOpening(pptx, model, content, pageNumber, appIconPath);
      } else {
        addContentSlide(pptx, model, content, pageNumber, appIconPath);
      }
    });
  } else {
    addOpening(pptx, model, 2, appIconPath);
    model.slides.forEach((content, index) => {
      addContentSlide(pptx, model, content, index + 3, appIconPath);
    });
  }
  return pptx;
}

export async function generatePresentation(options = {}) {
  const { document, config } = loadPresentationInputs(options);
  const model = buildPresentationModel(document, config, options.projectRoot ?? PROJECT_ROOT);
  const pptx = createPresentation(model);
  fs.mkdirSync(path.dirname(model.outputPath), { recursive: true });
  await pptx.writeFile({ fileName: model.outputPath, compression: true });
  if (model.coverageReportPath) {
    fs.mkdirSync(path.dirname(model.coverageReportPath), { recursive: true });
    fs.writeFileSync(
      model.coverageReportPath,
      `${JSON.stringify(model.coverage, null, 2)}\n`,
      'utf8',
    );
  }
  return { outputPath: model.outputPath, model };
}

const invokedAsScript = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) {
  generatePresentation()
    .then(({ outputPath, model }) => {
      console.log(`PPTX généré: ${outputPath}`);
      console.log(`Version documentaire: ${model.documentVersion}`);
      console.log(`Diapositives: ${model.pages ? model.pages.length + 1 : model.slides.length + 2}`);
      if (model.coverage) {
        console.log(`Rapport de couverture: ${model.coverageReportPath}`);
        console.log(
          `Couverture: ${model.coverage.totals.included} incluses, `
          + `${model.coverage.totals.planned} planifiées, `
          + `${model.coverage.totals.empty} vides, `
          + `${model.coverage.totals.unsupported} non prises en charge`,
        );
      }
    })
    .catch((error) => {
      console.error(`Échec de génération: ${error.message}`);
      process.exitCode = 1;
    });
}
