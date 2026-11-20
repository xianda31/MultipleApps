import type { SurveyQuestionDefinition } from '../../common/survey/survey-flow';

/** Longueur maximale du titre par défaut d'une question dans les résultats. */
export const RESULT_COLUMN_TITLE_MAX_LENGTH = 15;
export const DEFAULT_DETAIL_HEADER = 'Valeur choisie';
export const DEFAULT_COMMENT_HEADER = 'Commentaire';

type HeaderSource = Pick<SurveyQuestionDefinition, 'text' | 'options' | 'resultLabel' | 'detailResultLabel' | 'commentResultLabel'>;

export function hasDetailList(question: Pick<SurveyQuestionDefinition, 'options'>): boolean {
  return question.options.some(option => !!option.detailOptions?.length);
}

export function hasCommentBox(question: Pick<SurveyQuestionDefinition, 'options'>): boolean {
  return question.options.some(option => option.commentEnabled === true);
}

/** Tronque un titre au mot le plus proche de la longueur maximale. */
export function truncateColumnTitle(title: string, maxLength = RESULT_COLUMN_TITLE_MAX_LENGTH): string {
  if (title.length <= maxLength) return title;
  const previousBoundary = title.lastIndexOf(' ', maxLength);
  const nextBoundary = title.indexOf(' ', maxLength + 1);
  const nearestBoundary = previousBoundary <= 0
    ? maxLength
    : nextBoundary < 0 || maxLength - previousBoundary <= nextBoundary - maxLength
      ? previousBoundary
      : nextBoundary;
  return `${title.slice(0, nearestBoundary).trimEnd()}...`;
}

export function questionHeader(question: Pick<HeaderSource, 'text' | 'resultLabel'>): string {
  return question.resultLabel?.trim() || truncateColumnTitle(question.text ?? '');
}

export function detailHeader(question: Pick<HeaderSource, 'detailResultLabel'>): string {
  return question.detailResultLabel?.trim() || DEFAULT_DETAIL_HEADER;
}

export function commentHeader(question: Pick<HeaderSource, 'commentResultLabel'>): string {
  return question.commentResultLabel?.trim() || DEFAULT_COMMENT_HEADER;
}

/** En-têtes produits par une question dans le tableau de résultats et l'export CSV. */
export function resultHeaders(question: HeaderSource): string[] {
  return [
    questionHeader(question),
    ...(hasDetailList(question) ? [detailHeader(question)] : []),
    ...(hasCommentBox(question) ? [commentHeader(question)] : []),
  ];
}
