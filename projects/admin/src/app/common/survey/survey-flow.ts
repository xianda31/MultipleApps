export type SurveyNextAction = 'NEXT' | 'END';

export interface SurveyDetailOption {
  value: string;
  label: string;
}

export interface SurveyAnswer {
  optionValue: string;
  detailValue?: string;
}

export interface SurveyOptionDefinition {
  value: string;
  label: string;
  keyword?: string | null;
  nextAction: SurveyNextAction;
  payTag?: boolean | null;
  detailPrompt?: string | null;
  detailOptions?: SurveyDetailOption[] | null;
  detailOptionsOrigin?: 'manual' | 'memberImport' | null;
}

export interface SurveyQuestionDefinition {
  id: string;
  order: number;
  text: string;
  resultLabel?: string | null;
  detailResultLabel?: string | null;
  options: SurveyOptionDefinition[];
}

export type SurveyAnswers = Record<string, SurveyAnswer>;

export function selectedOption(
  question: SurveyQuestionDefinition,
  answers: SurveyAnswers,
): SurveyOptionDefinition | undefined {
  return question.options.find(option => option.value === answers[question.id]?.optionValue);
}

export function isAnswerComplete(
  question: SurveyQuestionDefinition,
  answer: SurveyAnswer | undefined,
): boolean {
  if (!answer) return false;
  const option = question.options.find(candidate => candidate.value === answer.optionValue);
  if (!option) return false;
  if (!option.detailOptions?.length) return true;
  return option.detailOptions.some(detail => detail.value === answer.detailValue);
}

export function getReachableQuestions(
  questions: SurveyQuestionDefinition[],
  answers: SurveyAnswers,
): SurveyQuestionDefinition[] {
  const reachable: SurveyQuestionDefinition[] = [];
  const ordered = [...questions].sort((a, b) => a.order - b.order);

  for (const question of ordered) {
    reachable.push(question);
    const option = selectedOption(question, answers);
    if (!option || !isAnswerComplete(question, answers[question.id]) || option.nextAction === 'END') break;
  }

  return reachable;
}

export function sanitizeSurveyAnswers(
  questions: SurveyQuestionDefinition[],
  answers: SurveyAnswers,
): SurveyAnswers {
  const reachableIds = new Set(getReachableQuestions(questions, answers).map(question => question.id));
  return Object.fromEntries(
    Object.entries(answers).filter(([questionId]) => reachableIds.has(questionId))
  );
}

export function isSurveyPathComplete(
  questions: SurveyQuestionDefinition[],
  answers: SurveyAnswers,
): boolean {
  if (questions.length === 0) return false;
  const reachable = getReachableQuestions(questions, answers);
  const lastQuestion = reachable.at(-1);
  if (!lastQuestion) return false;
  const option = selectedOption(lastQuestion, answers);
  if (!option || !isAnswerComplete(lastQuestion, answers[lastQuestion.id])) return false;
  return option.nextAction === 'END' || reachable.length === questions.length;
}

export function hasPaymentTag(
  questions: SurveyQuestionDefinition[],
  answers: SurveyAnswers,
): boolean {
  const sanitized = sanitizeSurveyAnswers(questions, answers);
  return getReachableQuestions(questions, sanitized)
    .some(question => selectedOption(question, sanitized)?.payTag === true);
}

export function validatePaymentTag(questions: SurveyQuestionDefinition[]): boolean {
  return questions.flatMap(question => question.options).filter(option => option.payTag).length <= 1;
}

export function requiresSurveyReconfirmation(
  previousQuestions: SurveyQuestionDefinition[],
  nextQuestions: SurveyQuestionDefinition[],
  answers: SurveyAnswers,
): boolean {
  const previousAnswers = sanitizeSurveyAnswers(previousQuestions, answers);
  const nextAnswers = sanitizeSurveyAnswers(nextQuestions, answers);
  const previousPath = getReachableQuestions(previousQuestions, previousAnswers).map(question => question.id);
  const nextPath = getReachableQuestions(nextQuestions, nextAnswers).map(question => question.id);

  if (previousPath.join('|') !== nextPath.join('|')) return true;
  if (!isSurveyPathComplete(nextQuestions, nextAnswers)) return true;

  const previousEntries = Object.entries(previousAnswers);
  const nextEntries = Object.entries(nextAnswers);
  if (previousEntries.length !== nextEntries.length) return true;

  for (const [questionId, answer] of nextEntries) {
    const previousAnswer = previousAnswers[questionId];
    if (previousAnswer?.optionValue !== answer.optionValue || previousAnswer?.detailValue !== answer.detailValue) {
      return true;
    }
    const previousQuestion = previousQuestions.find(question => question.id === questionId);
    const nextQuestion = nextQuestions.find(question => question.id === questionId);
    const previousOption = previousQuestion?.options.find(option => option.value === answer.optionValue);
    const nextOption = nextQuestion?.options.find(option => option.value === answer.optionValue);
    if (!previousOption || !nextOption) return true;
    if (previousOption.nextAction !== nextOption.nextAction || !!previousOption.payTag !== !!nextOption.payTag) {
      return true;
    }
  }

  return false;
}