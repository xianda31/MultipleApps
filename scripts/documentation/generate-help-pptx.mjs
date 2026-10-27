import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pptxgen from 'pptxgenjs';
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
  return { rowHeights: minimumRows, gap };
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
    ?? (content.procedures.map((procedure) => procedure.title).join(' / ')
      || 'Points de vigilance');
}

function procedureStepArea(layout) {
  const showTitle = layout === 'two-procedures';
  return showTitle
    ? { showTitle, topOffset: 0.76, heightOffset: 0.96 }
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
        0.42,
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

export function buildPresentationModel(document, config, projectRoot = PROJECT_ROOT) {
  if (!document.version || !Array.isArray(document.topics)) {
    throw new Error('La base documentaire doit contenir une version et des rubriques');
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
      procedures: selectedProcedures,
      illustrations: selectedIllustrations,
      cautions,
      layout: determineSlideLayout(
        selectedProcedures,
        selectedIllustrations,
        cautions,
        index + 1,
      ),
    };
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
        title: `${procedure.title} — schéma explicatif`,
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
  slide.addShape('roundRect', {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    line: { color: THEME.colors.border, width: 1 },
    fill: { color: THEME.colors.background },
  });
  slide.addShape('rect', {
    x,
    y: y + 0.14,
    w: 0.07,
    h: h - 0.28,
    line: { color: THEME.colors.green, transparency: 100 },
    fill: { color: THEME.colors.green },
  });
  if (showTitle) {
    addText(slide, procedure.title, {
      x: x + 0.28,
      y: y + 0.2,
      w: w - 0.56,
      h: 0.42,
      fontFace: THEME.fontFamilies.heading,
      fontSize: THEME.fontSizes.procedureTitle,
      bold: true,
      color: THEME.colors.greenDark,
    });
  }
  const stepArea = procedureStepArea(showTitle ? 'two-procedures' : 'single-procedure');
  addStepList(
    slide,
    procedure.steps,
    x + 0.3,
    y + stepArea.topOffset,
    w - 0.6,
    h - stepArea.heightOffset,
    fontSize,
    `Diapositive ${slideNumber}, procédure ${procedure.id}`,
  );
}

function svgContainBox(filePath, x, y, w, h) {
  const svg = fs.readFileSync(filePath, 'utf8');
  const viewBox = svg.match(/viewBox=["']\s*[\d.-]+\s+[\d.-]+\s+([\d.-]+)\s+([\d.-]+)\s*["']/i);
  const sourceWidth = viewBox ? Number(viewBox[1]) : w;
  const sourceHeight = viewBox ? Number(viewBox[2]) : h;
  const scale = Math.min(w / sourceWidth, h / sourceHeight);
  const targetWidth = sourceWidth * scale;
  const targetHeight = sourceHeight * scale;
  return {
    x: x + (w - targetWidth) / 2,
    y: y + (h - targetHeight) / 2,
    w: targetWidth,
    h: targetHeight,
  };
}

function addIllustration(slide, illustration, x, y, w, h) {
  const box = path.extname(illustration.filePath).toLowerCase() === '.svg'
    ? svgContainBox(illustration.filePath, x, y, w, h - 0.5)
    : { x, y, w, h: h - 0.5 };
  slide.addImage({
    path: illustration.filePath,
    ...box,
    altText: illustration.alt,
  });
  if (illustration.caption) {
    addText(slide, illustration.caption, {
      x,
      y: y + h - 0.42,
      w,
      h: 0.34,
      align: 'center',
      italic: true,
      fontSize: THEME.fontSizes.caption,
      color: THEME.colors.muted,
    });
  }
}

function addCautions(slide, cautions, x, y, w, h, showTitle = true) {
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
    h - (showTitle ? 1 : 0.55),
    THEME.fontSizes.cautionBody,
    'Précautions',
  );
}

function addTraceNotes(slide, version, topicIds = [], procedureIds = [], illustrationIds = []) {
  slide.addNotes([
    `Version documentaire: ${version}`,
    `Rubriques: ${topicIds.join(', ') || 'aucune'}`,
    `Procédures: ${procedureIds.join(', ') || 'aucune'}`,
    `Illustrations: ${illustrationIds.join(', ') || 'aucune'}`,
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
  model.openingTopics.forEach((topic, index) => {
    const y = 1.75 + index * 2.15;
    slide.addShape('roundRect', {
      x: 0.75,
      y,
      w: 11.85,
      h: 1.65,
      line: { color: THEME.colors.border, width: 1 },
      fill: { color: THEME.colors.background },
    });
    slide.addShape('rect', {
      x: 0.75,
      y: y + 0.12,
      w: 0.07,
      h: 1.41,
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
      y: y + 0.74,
      w: 10.9,
      h: 0.62,
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
  addHeader(slide, title, content.topic.title);
  const verifiedLayout = determineSlideLayout(
    content.procedures,
    content.illustrations,
    content.cautions,
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
      ?? content.procedures.map((procedure) => procedure.id),
    content.traceIllustrationIds
      ?? content.illustrations.map((illustration) => illustration.id),
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
  addOpening(pptx, model, 2, appIconPath);
  model.slides.forEach((content, index) => {
    addContentSlide(pptx, model, content, index + 3, appIconPath);
  });
  return pptx;
}

export async function generatePresentation(options = {}) {
  const { document, config } = loadPresentationInputs(options);
  const model = buildPresentationModel(document, config, options.projectRoot ?? PROJECT_ROOT);
  const pptx = createPresentation(model);
  fs.mkdirSync(path.dirname(model.outputPath), { recursive: true });
  await pptx.writeFile({ fileName: model.outputPath, compression: true });
  return { outputPath: model.outputPath, model };
}

const invokedAsScript = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) {
  generatePresentation()
    .then(({ outputPath, model }) => {
      console.log(`PPTX généré: ${outputPath}`);
      console.log(`Version documentaire: ${model.documentVersion}`);
      console.log(`Diapositives: ${model.slides.length + 2}`);
    })
    .catch((error) => {
      console.error(`Échec de génération: ${error.message}`);
      process.exitCode = 1;
    });
}
