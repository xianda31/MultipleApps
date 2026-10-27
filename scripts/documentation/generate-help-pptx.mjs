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

  const slides = config.slides.map((slideConfig, index) => {
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

    return {
      topic,
      procedures: selectedProcedures,
      illustrations: selectedIllustrations,
      cautions: slideConfig.includeCautions ? (topic.caution ?? []) : [],
    };
  });

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
    fontFace: THEME.fonts.body,
    color: THEME.colors.text,
    margin: 0,
    breakLine: false,
    valign: 'mid',
    ...options,
  });
}

function addFooter(slide, pageNumber, version, logoPath) {
  slide.addShape('line', {
    x: 0.4,
    y: 6.96,
    w: 12.53,
    h: 0,
    line: { color: THEME.colors.border, width: 1 },
  });
  slide.addImage({ path: logoPath, x: 0.42, y: 7.04, w: 0.8, h: 0.3, altText: 'Logo BCSTO' });
  addText(slide, `Documentation ${version}`, {
    x: 1.35,
    y: 7.04,
    w: 3.2,
    h: 0.28,
    fontSize: THEME.fonts.small,
    color: THEME.colors.muted,
  });
  addText(slide, String(pageNumber), {
    x: 12.2,
    y: 7.04,
    w: 0.7,
    h: 0.28,
    align: 'right',
    fontSize: THEME.fonts.small,
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
    fontFace: THEME.fonts.heading,
    fontSize: THEME.fonts.slideTitle,
    bold: true,
    color: THEME.colors.title,
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

function addStepList(slide, steps, x, y, w, h, fontSize) {
  const rowHeight = h / Math.max(steps.length, 1);
  steps.forEach((step, index) => {
    const top = y + index * rowHeight;
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
      fit: 'shrink',
      breakLine: true,
    });
  });
}

function addProcedureCard(slide, procedure, x, y, w, h) {
  slide.addShape('roundRect', {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    line: { color: THEME.colors.border, width: 1 },
    fill: { color: THEME.colors.greenLight },
  });
  addText(slide, procedure.title, {
    x: x + 0.28,
    y: y + 0.2,
    w: w - 0.56,
    h: 0.42,
    fontFace: THEME.fonts.heading,
    fontSize: THEME.fonts.procedureTitle,
    bold: true,
    color: THEME.colors.greenDark,
  });
  const fontSize = w < 6.2 ? 16 : THEME.fonts.body;
  addStepList(slide, procedure.steps, x + 0.3, y + 0.76, w - 0.6, h - 0.96, fontSize);
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
      fontSize: 10,
      color: THEME.colors.muted,
      fit: 'shrink',
    });
  }
}

function addCautions(slide, cautions, x, y, w, h) {
  slide.addShape('roundRect', {
    x,
    y,
    w,
    h,
    line: { color: 'E5C56C', width: 1 },
    fill: { color: THEME.colors.amberLight },
  });
  addText(slide, 'Points de vigilance', {
    x: x + 0.25,
    y: y + 0.2,
    w: w - 0.5,
    h: 0.4,
    bold: true,
    fontSize: 18,
    color: '7A5700',
  });
  addStepList(slide, cautions, x + 0.28, y + 0.78, w - 0.56, h - 1, 15.5);
}

function addTraceNotes(slide, version, topicIds = [], procedureIds = [], illustrationIds = []) {
  slide.addNotes([
    `Version documentaire: ${version}`,
    `Rubriques: ${topicIds.join(', ') || 'aucune'}`,
    `Procédures: ${procedureIds.join(', ') || 'aucune'}`,
    `Illustrations: ${illustrationIds.join(', ') || 'aucune'}`,
  ].join('\n'));
}

function addCover(pptx, model, logoPath) {
  const slide = pptx.addSlide();
  slide.background = { color: THEME.colors.background };
  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: 1.05,
    h: THEME.height,
    line: { color: THEME.colors.green, transparency: 100 },
    fill: { color: THEME.colors.green },
  });
  slide.addImage({ path: logoPath, x: 1.55, y: 0.75, w: 2.2, h: 0.83, altText: 'Logo BCSTO' });
  addText(slide, model.presentationTitle, {
    x: 1.55,
    y: 2,
    w: 10.8,
    h: 1.15,
    fontFace: THEME.fonts.heading,
    fontSize: THEME.fonts.coverTitle,
    bold: true,
    color: THEME.colors.title,
  });
  addText(slide, model.presentationSubtitle, {
    x: 1.58,
    y: 3.25,
    w: 9.8,
    h: 0.55,
    fontSize: 19,
    color: THEME.colors.greenDark,
  });
  addText(slide, `Version documentaire ${model.documentVersion}`, {
    x: 1.58,
    y: 6.45,
    w: 5.4,
    h: 0.4,
    fontSize: 12,
    color: THEME.colors.muted,
  });
  addTraceNotes(slide, model.documentVersion);
}

function addOpening(pptx, model, pageNumber, logoPath) {
  const slide = pptx.addSlide();
  slide.background = { color: THEME.colors.background };
  addText(slide, model.sectionTitle, {
    x: 0.65,
    y: 0.72,
    w: 11.8,
    h: 0.7,
    fontFace: THEME.fonts.heading,
    fontSize: THEME.fonts.sectionTitle,
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
      fill: { color: index % 2 === 0 ? THEME.colors.greenLight : 'F6F8F6' },
    });
    addText(slide, topic.title, {
      x: 1.05,
      y: y + 0.22,
      w: 3.4,
      h: 0.42,
      fontFace: THEME.fonts.heading,
      fontSize: 21,
      bold: true,
      color: THEME.colors.greenDark,
    });
    addText(slide, topic.summary, {
      x: 1.05,
      y: y + 0.74,
      w: 10.9,
      h: 0.62,
      fontSize: 17,
      fit: 'shrink',
      breakLine: true,
    });
  });
  addFooter(slide, pageNumber, model.documentVersion, logoPath);
  addTraceNotes(slide, model.documentVersion, model.openingTopics.map((topic) => topic.id));
}

function addContentSlide(pptx, model, content, pageNumber, logoPath) {
  const slide = pptx.addSlide();
  slide.background = { color: THEME.colors.background };
  const title = content.procedures.map((procedure) => procedure.title).join(' / ');
  addHeader(slide, title, content.topic.title);

  if (content.illustrations.length > 0) {
    addProcedureCard(slide, content.procedures[0], 0.55, 1.42, 5.7, 5.2);
    addIllustration(slide, content.illustrations[0], 6.55, 1.55, 6.2, 4.95);
  } else if (content.cautions.length > 0) {
    addProcedureCard(slide, content.procedures[0], 0.55, 1.42, 8.1, 5.2);
    addCautions(slide, content.cautions, 8.9, 1.42, 3.9, 5.2);
  } else if (content.procedures.length === 2) {
    addProcedureCard(slide, content.procedures[0], 0.55, 1.42, 6.05, 5.2);
    addProcedureCard(slide, content.procedures[1], 6.75, 1.42, 6.05, 5.2);
  } else {
    addProcedureCard(slide, content.procedures[0], 0.55, 1.42, 12.25, 5.2);
  }

  addFooter(slide, pageNumber, model.documentVersion, logoPath);
  addTraceNotes(
    slide,
    model.documentVersion,
    [content.topic.id],
    content.procedures.map((procedure) => procedure.id),
    content.illustrations.map((illustration) => illustration.id),
  );
}

export function createPresentation(model) {
  const logoPath = path.resolve(PROJECT_ROOT, THEME.logoPath);
  if (!fs.existsSync(logoPath)) {
    throw new Error(`Logo BCSTO introuvable: ${logoPath}`);
  }

  const pptx = new pptxgen();
  pptx.layout = THEME.layout;
  pptx.author = 'BCSTO';
  pptx.company = 'Bridge Club Saint-Orens';
  pptx.subject = `Documentation commune ${model.documentVersion}`;
  pptx.title = model.presentationTitle;
  pptx.lang = 'fr-FR';
  pptx.theme = {
    headFontFace: THEME.fonts.heading,
    bodyFontFace: THEME.fonts.body,
    lang: 'fr-FR',
  };

  addCover(pptx, model, logoPath);
  addOpening(pptx, model, 2, logoPath);
  model.slides.forEach((content, index) => {
    addContentSlide(pptx, model, content, index + 3, logoPath);
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
