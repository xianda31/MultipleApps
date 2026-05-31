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

// ── Handler ────────────────────────────────────────────────────────────────

export const handler = async (event: any) => {
  const method = event.requestContext?.http?.method ?? event.httpMethod ?? 'GET';

  // ── GET : charger le contexte du sondage ─────────────────────────────────
  if (method === 'GET') {
    const token = event.queryStringParameters?.token;
    const { valid, tokenItem, reason } = await validateToken(token);
    if (!valid) return err(410, reason ?? 'Token invalide');

    const [survey, questions, existing] = await Promise.all([
      getSurvey(tokenItem!.surveyId),
      getQuestions(tokenItem!.surveyId),
      getExistingResponse(tokenItem!.surveyId, tokenItem!.memberId),
    ]);

    if (!survey) return err(404, 'Sondage introuvable');

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
                surveyType: survey.surveyType ?? 'poll', status: survey.status ?? 'active', closingDate: survey.closingDate,
                footerNote: survey.footerNote },
      questions: questions.map((q: any) => ({ id: q.id, text: q.text, options: q.options, order: q.order })),
      existingResponse: existing
        ? { id: existing.id, answers: existing.answers, status: existing.status, submittedAt: existing.submittedAt }
        : null,
      memberId: tokenItem!.memberId,
      memberName: tokenItem!.memberName,
    });
  }

  // ── POST : soumettre / modifier les réponses ──────────────────────────────
  if (method === 'POST') {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { token, answers } = body ?? {};

    const { valid, tokenItem, reason } = await validateToken(token);
    if (!valid) return err(410, reason ?? 'Token invalide');
    if (!answers || typeof answers !== 'object') return err(400, 'Réponses manquantes');

    const now = new Date().toISOString();
    const existing = await getExistingResponse(tokenItem!.surveyId, tokenItem!.memberId);

    if (existing) {
      await db.send(new UpdateCommand({
        TableName: RESPONSE_TABLE,
        Key: { id: existing.id },
        UpdateExpression: 'SET answers = :a, #s = :s, submittedAt = :t, updatedAt = :t',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':a': JSON.stringify(answers),
          ':s': 'submitted',
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
          answers: JSON.stringify(answers),
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

  // ── PATCH : changer le statut (RSVP) ─────────────────────────────────────
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
