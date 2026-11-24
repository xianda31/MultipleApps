import { createHash } from 'node:crypto';
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';

export interface SaleLockTables {
  operations: string;
  locks: string;
}

export type SaleOutcome = 'completed' | 'cancelled';

// The server must derive this hash from the immutable sale and payment parameters.
function saleFingerprint(participants: string[], intentHash: string): string {
  return createHash('sha256').update(JSON.stringify([participants, intentHash])).digest('hex');
}

function validateOperation(operationId: string, participants: string[], intentHash: string): string[] {
  if (!operationId || operationId.trim() !== operationId || participants.length === 0
    || participants.some(id => !id || id.trim() !== id)
    || new Set(participants).size !== participants.length || !/^[0-9a-f]{64}$/.test(intentHash)) {
    throw new Error('Opération ou titulaires de vente invalides.');
  }
  if (participants.length > 99) throw new Error('Trop de titulaires pour protéger la vente.');
  return [...participants].sort();
}

async function operationRecord(client: DynamoDBDocumentClient, table: string, operationId: string) {
  return (await client.send(new GetCommand({
    TableName: table, Key: { id: operationId }, ConsistentRead: true,
  }))).Item;
}

export async function acquireSaleLocks(
  client: DynamoDBDocumentClient, tables: SaleLockTables, operationId: string, participantIds: string[],
  intentHash: string, now: Date,
): Promise<void> {
  const participants = validateOperation(operationId, participantIds, intentHash);
  if (!Number.isFinite(now.getTime())) throw new Error('Date de vente invalide.');
  const fingerprint = saleFingerprint(participants, intentHash);
  const timestamp = now.toISOString();
  try {
    await client.send(new TransactWriteCommand({
      TransactItems: [
        { Put: {
          TableName: tables.operations,
          Item: { id: operationId, fingerprint, status: 'held', createdAt: timestamp, updatedAt: timestamp },
          ConditionExpression: 'attribute_not_exists(id)',
        } },
        ...participants.map(id => ({ Put: {
          TableName: tables.locks,
          Item: { id, operationId, createdAt: timestamp },
          ConditionExpression: 'attribute_not_exists(id)',
        } })),
      ],
    }));
  } catch (error) {
    const operation = await operationRecord(client, tables.operations, operationId);
    if (!operation) throw error;
    if (operation['fingerprint'] !== fingerprint) throw new Error('Identifiant de vente déjà utilisé pour une autre demande.');
    if (operation['status'] !== 'held') throw new Error('Cette vente est déjà terminée.');
    const locks = await Promise.all(participants.map(id => client.send(new GetCommand({
      TableName: tables.locks, Key: { id }, ConsistentRead: true,
    }))));
    if (locks.some(result => result.Item?.['operationId'] !== operationId)) {
      throw new Error('Verrou de vente incohérent. Contactez un responsable.');
    }
  }
}

// The caller must establish the payment outcome server-side before releasing any lock.
export async function releaseSaleLocks(
  client: DynamoDBDocumentClient, tables: SaleLockTables, operationId: string, participantIds: string[],
  intentHash: string, outcome: SaleOutcome, now: Date,
): Promise<void> {
  const participants = validateOperation(operationId, participantIds, intentHash);
  if ((outcome !== 'completed' && outcome !== 'cancelled') || !Number.isFinite(now.getTime())) {
    throw new Error('Résultat de vente invalide.');
  }
  const fingerprint = saleFingerprint(participants, intentHash);
  try {
    await client.send(new TransactWriteCommand({
      TransactItems: [
        { Update: {
          TableName: tables.operations, Key: { id: operationId },
          UpdateExpression: 'SET #status = :outcome, updatedAt = :now',
          ConditionExpression: '#status = :held AND fingerprint = :fingerprint',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: { ':held': 'held', ':outcome': outcome, ':now': now.toISOString(), ':fingerprint': fingerprint },
        } },
        ...participants.map(id => ({ Delete: {
          TableName: tables.locks, Key: { id },
          ConditionExpression: 'operationId = :operationId',
          ExpressionAttributeValues: { ':operationId': operationId },
        } })),
      ],
    }));
  } catch (error) {
    const operation = await operationRecord(client, tables.operations, operationId);
    if (operation?.['fingerprint'] === fingerprint && operation['status'] === outcome) {
      const locks = await Promise.all(participants.map(id => client.send(new GetCommand({
        TableName: tables.locks, Key: { id }, ConsistentRead: true,
      }))));
      if (locks.every(result => result.Item?.['operationId'] !== operationId)) return;
      throw new Error('Libération de vente incohérente. Contactez un responsable.');
    }
    throw error;
  }
}
