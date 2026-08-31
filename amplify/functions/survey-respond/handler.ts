import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(client);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const ok = (body: unknown) => ({
  statusCode: 200,
  headers: CORS,
  body: JSON.stringify(body),
});

const err = (status: number, message: string) => ({
  statusCode: status,
  headers: CORS,
  body: JSON.stringify({ error: message }),
});

// ── Env ────────────────────────────────────────────────────────────────────
const TOKEN_TABLE    = process.env.SURVEY_TOKEN_TABLE_NAME!;
const RESPONSE_TABLE = process.env.SURVEY_RESPONSE_TABLE_NAME!;
const SURVEY_TABLE   = process.env.SURVEY_TABLE_NAME!;
const QUESTION_TABLE = process.env.SURVEY_QUESTION_TABLE_NAME!;

// ── Helpers ────────────────────────────────────────────────────────────────

async function getToken(token: string) {
  const { Item } = await db.send(new GetCommand({ TableName: TOKEN_TABLE, Key: { token } }));
  return Item ?? null;
}

async function validateToken(token: string) {
  if (!token) return { valid: false, tokenItem: null, reason: 'Token manquant' };
  const t = await getToken(token);
  if (!t) return { valid: false, tokenItem: null, reason: 'Token inconnu ou expiré' };
  if (t.expiresAt && new Date(t.expiresAt) < new Date()) {
    return { valid: false, tokenItem: t, reason: 'Le sondage est clôturé' };
  }
  return { valid: true, tokenItem: t, reason: null };
}

async function getSurvey(surveyId: string) {
  const { Item } = await db.send(new GetCommand({ TableName: SURVEY_TABLE, Key: { id: surveyId } }));
  return Item ?? null;
}

async function getQuestions(surveyId: string) {
  const { Items } = await db.send(new ScanCommand({
    TableName: QUESTION_TABLE,
    FilterExpression: 'surveyId = :sid',
    ExpressionAttributeValues: { ':sid': surveyId },
  }));
  return ((Items ?? []) as any[]).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

async function getExistingResponse(surveyId: string, memberId: string) {
  const { Items } = await db.send(new ScanCommand({
    TableName: RESPONSE_TABLE,
    FilterExpression: 'surveyId = :sid AND memberId = :mid',
    ExpressionAttributeValues: { ':sid': surveyId, ':mid': memberId },
  }));
  return Items?.[0] ?? null;
}

async function getAllResponses(surveyId: string) {
  const { Items } = await db.send(new ScanCommand({
    TableName: RESPONSE_TABLE,
    FilterExpression: 'surveyId = :sid',
    ExpressionAttributeValues: { ':sid': surveyId },
  }));
  return (Items ?? []) as any[];
}

function computeAggregatedResults(
  questions: any[],
  allResponses: any[],
): Record<string, number[]> {
  const result: Record<string, number[]> = {};
  for (const q of questions) {
    result[q.id] = (q.options ?? []).map(() => 0);
  }
  for (const response of allResponses) {
    let answers = response.answers;
    if (typeof answers === 'string') {
      try { answers = JSON.parse(answers); } catch { continue; }
    }
    if (!answers || typeof answers !== 'object') continue;
    for (const [qId, answer] of Object.entries(answers)) {
      const question = questions.find(q => q.id === qId);
      const optionValue = typeof answer === 'object' && answer !== null ? (answer as any).optionValue : undefined;
      const idx = (question?.options ?? []).findIndex((option: any) => option.value === optionValue);
      if (result[qId] && Number.isInteger(idx) && idx >= 0 && idx < result[qId].length) {
        result[qId][idx] += 1;
      }
    }
  }
  return result;
}

function resolveSubmission(questions: any[], answers: Record<string, unknown>) {
  const sanitized: Record<string, { optionValue: string; detailValue?: string }> = {};
  let payable = false;
  let complete = false;

  for (const question of questions) {
    const answer = answers[question.id];
    if (!answer || typeof answer !== 'object') return { valid: false, reason: 'Réponse manquante' };
    const optionValue = (answer as any).optionValue;
    const detailValue = (answer as any).detailValue;
    if (typeof optionValue !== 'string') return { valid: false, reason: 'Réponse invalide' };
    const option = (question.options ?? []).find((candidate: any) => candidate.value === optionValue);
    if (!option) return { valid: false, reason: 'Choix invalide' };
    const detailOptions = option.detailOptions ?? [];
    if (detailOptions.length > 0) {
      if (typeof detailValue !== 'string' || !detailOptions.some((detail: any) => detail.value === detailValue)) {
        return { valid: false, reason: 'Valeur de liste invalide' };
      }
    } else if (detailValue !== undefined) {
      return { valid: false, reason: 'Détail inattendu' };
    }

    sanitized[question.id] = {
      optionValue,
      ...(detailOptions.length > 0 ? { detailValue } : {}),
    };
    payable ||= option.payTag === true;
    if (option.nextAction === 'END') {
      complete = true;
      break;
    }
  }

  if (Object.keys(sanitized).length === questions.length) complete = true;
  if (!complete) return { valid: false, reason: 'Parcours incomplet' };
  if (Object.keys(answers).some(questionId => !(questionId in sanitized))) {
    return { valid: false, reason: 'Le formulaire contient des réponses hors parcours' };
  }
  return { valid: true, sanitized, payable };
}

// ── Handler ────────────────────────────────────────────────────────────────

export const handler = async (event: any) => {
  const method = event.requestContext?.http?.method ?? event.httpMethod ?? 'GET';

  // ── GET : charger le contexte du sondage ─────────────────────────────────
  if (method === 'GET') {
    const token = event.queryStringParameters?.token;
    const { valid, tokenItem, reason } = await validateToken(token);
    if (!valid) return err(410, reason ?? 'Token invalide');

    const [survey, questions, existing, allResponses] = await Promise.all([
      getSurvey(tokenItem!.surveyId),
      getQuestions(tokenItem!.surveyId),
      getExistingResponse(tokenItem!.surveyId, tokenItem!.memberId),
      getAllResponses(tokenItem!.surveyId),
    ]);

    if (!survey) return err(404, 'Sondage introuvable');
    const confirmedResponses = allResponses.filter(response => response.requiresReconfirmation !== true);

    // Mettre à jour lastActivityAt
    await db.send(new UpdateCommand({
      TableName: TOKEN_TABLE,
      Key: { token },
      UpdateExpression: 'SET lastActivityAt = :now',
      ExpressionAttributeValues: { ':now': new Date().toISOString() },
    }));

    return ok({
      token,
      survey: { id: survey.id, title: survey.title, description: survey.description,
                status: survey.status ?? 'active', closingDate: survey.closingDate,
                footerNote: survey.footerNote },
      questions: questions.map((q: any) => ({
        id: q.id, text: q.text, resultLabel: q.resultLabel,
        detailResultLabel: q.detailResultLabel, options: q.options, order: q.order,
      })),
      existingResponse: existing
        ? { id: existing.id, answers: existing.answers, status: existing.status,
            submittedAt: existing.submittedAt,
            requiresReconfirmation: existing.requiresReconfirmation === true }
        : null,
      memberId: tokenItem!.memberId,
      memberName: tokenItem!.memberName,
      aggregatedResults: computeAggregatedResults(questions, confirmedResponses),
      totalRespondents: confirmedResponses.length,
    });
  }

  // ── POST : soumettre / modifier les réponses ──────────────────────────────
  if (method === 'POST') {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { token, answers } = body ?? {};

    const { valid, tokenItem, reason } = await validateToken(token);
    if (!valid) return err(410, reason ?? 'Token invalide');
    if (!answers || typeof answers !== 'object') return err(400, 'Réponses manquantes');

    const [survey, questions] = await Promise.all([
      getSurvey(tokenItem!.surveyId),
      getQuestions(tokenItem!.surveyId),
    ]);
    if (!survey) return err(404, 'Sondage introuvable');
    const payTagCount = questions.flatMap(question => question.options ?? []).filter(option => option.payTag).length;
    if (payTagCount > 1) return err(500, 'Configuration de paiement invalide');
    const submission = resolveSubmission(questions, answers);
    if (!submission.valid) return err(400, submission.reason ?? 'Réponses invalides');
    const paymentStatus = submission.payable ? 'payable' : 'notApplicable';
    const paymentProductId = submission.payable ? survey.productTag : undefined;
    if (submission.payable && !paymentProductId) return err(500, 'Produit de paiement non configuré');

    const now = new Date().toISOString();
    const existing = await getExistingResponse(tokenItem!.surveyId, tokenItem!.memberId);

    if (existing) {
      await db.send(new UpdateCommand({
        TableName: RESPONSE_TABLE,
        Key: { id: existing.id },
        UpdateExpression: 'SET answers = :a, #s = :s, paymentStatus = :ps, paymentProductId = :pp, requiresReconfirmation = :rr, submittedAt = :t, updatedAt = :t',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':a': JSON.stringify(submission.sanitized),
          ':s': 'submitted',
          ':ps': paymentStatus,
          ':pp': paymentProductId ?? null,
          ':rr': false,
          ':t': now,
        },
      }));
    } else {
      await db.send(new PutCommand({
        TableName: RESPONSE_TABLE,
        Item: {
          id: `${tokenItem!.surveyId}#${tokenItem!.memberId}#${Date.now()}`,
          surveyId: tokenItem!.surveyId,
          surveyTokenId: token,
          memberId: tokenItem!.memberId,
          memberEmail: tokenItem!.memberEmail,
          memberName: tokenItem!.memberName ?? '',
          answers: JSON.stringify(submission.sanitized),
          paymentStatus,
          requiresReconfirmation: false,
          ...(paymentProductId ? { paymentProductId } : {}),
          status: 'submitted',
          submittedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      }));
    }

    await db.send(new UpdateCommand({
      TableName: TOKEN_TABLE,
      Key: { token },
      UpdateExpression: 'SET lastActivityAt = :now',
      ExpressionAttributeValues: { ':now': now },
    }));

    return ok({ success: true });
  }

  // ── PATCH : changer le statut de la réponse ──────────────────────────────
  if (method === 'PATCH') {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { token, status } = body ?? {};

    const allowed = ['confirmed', 'declined', 'cancelled', 'submitted'];
    if (!allowed.includes(status)) return err(400, `Statut invalide : ${status}`);

    const { valid, tokenItem, reason } = await validateToken(token);
    if (!valid) return err(410, reason ?? 'Token invalide');

    const existing = await getExistingResponse(tokenItem!.surveyId, tokenItem!.memberId);
    if (!existing) return err(404, 'Aucune réponse à mettre à jour');

    const now = new Date().toISOString();
    await db.send(new UpdateCommand({
      TableName: RESPONSE_TABLE,
      Key: { id: existing.id },
      UpdateExpression: 'SET #s = :s, submittedAt = :t, updatedAt = :t',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':s': status, ':t': now },
    }));

    await db.send(new UpdateCommand({
      TableName: TOKEN_TABLE,
      Key: { token },
      UpdateExpression: 'SET lastActivityAt = :now',
      ExpressionAttributeValues: { ':now': now },
    }));

    return ok({ success: true, status });
  }

  return err(405, 'Méthode non autorisée');
};
