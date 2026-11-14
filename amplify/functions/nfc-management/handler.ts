import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, GetCommand, ScanCommand, TransactWriteCommand,
  type TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { nfcChangeSchema, nfcCommitSchema, type NfcChange } from '../../../projects/common/nfc-contract';
import type { Schema } from '../../data/resource';

export const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const models = { card: 'MemberNfcCard', request: 'NfcCardRequest', batch: 'NfcImportBatch' } as const;

function table(model: string): string {
  const name = process.env[`${model}_TABLE`];
  if (!name) throw new Error(`Configuration NFC absente : ${model}.`);
  return name;
}

function key(change: NfcChange): Record<string, string> {
  if (change.entity === 'card') return { uid: change.record.uid };
  if (change.entity === 'request') return { licenseNumber: change.record.licenseNumber };
  return { id: change.record.id };
}

export async function commitNfc(input: unknown, actor: string) {
  const { changes, action, cardChecks } = nfcCommitSchema.parse(input);
  const writes: NonNullable<TransactWriteCommandInput['TransactItems']> = [];
  const activeLicenses = new Set<string>();
  const saved: NfcChange[] = [];
  const keys = new Set<string>();
  for (const check of cardChecks) writes.push({ ConditionCheck: {
    TableName: table('MemberNfcCard'), Key: { uid: check.uid },
    ConditionExpression: 'updatedAt = :version',
    ExpressionAttributeValues: { ':version': check.updatedAt },
  } });
  for (const change of changes) {
    const model = models[change.entity];
    const itemKey = key(change);
    const subject = `${change.entity}:${Object.values(itemKey)[0]}`;
    if (keys.has(subject)) throw new Error('Modification NFC dupliquée.');
    keys.add(subject);
    const { Item: previous } = await client.send(new GetCommand({
      TableName: table(model), Key: itemKey, ConsistentRead: true,
    }));
    if ((previous?.['updatedAt'] ?? null) !== change.expectedVersion) {
      throw new Error('Modification concurrente : actualisez les données NFC.');
    }
    const now = new Date(Math.max(Date.now(), Date.parse(previous?.['updatedAt'] ?? '') + 1 || 0)).toISOString();
    const record = { ...change.record, createdAt: previous?.['createdAt'] ?? now, updatedAt: now };
    if (change.entity === 'card') {
      const card = change.record;
      if (card.status === 'ACTIVE') {
        if (!card.licenseNumber || card.stockState !== 'ASSIGNED' || !card.kind) {
          throw new Error('Une carte active doit être attribuée et avoir un type.');
        }
        activeLicenses.add(card.licenseNumber);
      }
      if (card.stockState === 'AVAILABLE' && (card.kind !== 'WHITE' || card.licenseNumber || card.status !== 'DISABLED')) {
        throw new Error('Stock disponible incohérent.');
      }
      if (previous?.['kind'] && previous['kind'] !== card.kind) throw new Error('Le type de carte est immuable.');
      if (previous?.['licenseNumber'] && previous['licenseNumber'] !== card.licenseNumber && card.licenseNumber
        && (previous['status'] === 'ACTIVE' || previous['kind'] === 'WHITE')) {
        throw new Error('Transfert interdit : désactivation ou restitution préalable requise.');
      }
      if (card.status === 'ACTIVE' && ['LOST', 'RETIRED'].includes(previous?.['stockState'])) {
        throw new Error('Carte perdue ou hors service.');
      }
      if (previous?.['stockState'] === 'RETIRED' && card.stockState !== 'RETIRED') {
        throw new Error('Une carte hors service ne peut pas retourner en circulation.');
      }
      const assigning = card.status === 'ACTIVE'
        && (previous?.['status'] !== 'ACTIVE' || previous?.['licenseNumber'] !== card.licenseNumber);
      Object.assign(record, {
        licenseNumber: card.licenseNumber || undefined,
        assignedBy: assigning ? actor : card.assignedBy,
        assignedAt: assigning ? now : card.assignedAt,
      });
    }
    if (change.entity === 'request') {
      const request = change.record;
      if (request.stage !== 'CANCELLED') activeLicenses.add(request.licenseNumber);
      if (request.stage === 'ORDERED' && (!request.orderReference || !request.orderQuantity)) {
        throw new Error('Référence et quantité de commande requises (minimum 10).');
      }
      if (request.stage === 'RECEIVED' || request.stage === 'DELIVERED') {
        if (!request.uid) throw new Error('Carte définitive requise.');
        writes.push({ ConditionCheck: {
          TableName: table('MemberNfcCard'), Key: { uid: request.uid },
          ConditionExpression: 'licenseNumber = :license AND #status = :active AND kind = :personal',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: { ':license': request.licenseNumber, ':active': 'ACTIVE', ':personal': 'PERSONAL' },
        } });
      }
    }
    if (change.entity === 'batch') {
      const batch = change.record;
      if (!previous && (batch.cursor !== 0 || batch.results.length || batch.rows.some(row => row.outcome === 'ERROR'))) {
        throw new Error('Un import doit commencer par un lot intégralement prévalidé.');
      }
      if (previous && (batch.cursor !== previous['cursor'] + 1
        || JSON.stringify(batch.rows) !== previous['rows']
        || JSON.stringify(batch.results.slice(0, -1)) !== previous['results'])) {
        throw new Error('Progression du lot invalide.');
      }
      if (batch.cursor !== batch.results.length || batch.cursor > batch.rows.length) {
        throw new Error('Résultats du lot incohérents.');
      }
      Object.assign(record, { actor: previous?.['actor'] ?? actor });
    }
    const stored = change.entity === 'batch'
      ? { ...record, rows: JSON.stringify(change.record.rows), results: JSON.stringify(change.record.results) }
      : record;
    if (Buffer.byteLength(JSON.stringify(stored), 'utf8') > 350_000) {
      throw new Error('Lot trop volumineux. Scindez le fichier avant de le prévalider.');
    }
    writes.push({ Put: {
      TableName: table(model), Item: { ...stored, __typename: model },
      ConditionExpression: previous ? 'updatedAt = :version' : 'attribute_not_exists(#key)',
      ...(previous ? { ExpressionAttributeValues: { ':version': change.expectedVersion } }
        : { ExpressionAttributeNames: { '#key': Object.keys(itemKey)[0] } }),
    } });
    // Batch progress already contains its per-row results; do not duplicate the whole file in history.
    if (change.entity !== 'batch') writes.push({ Put: {
      TableName: table('NfcHistory'),
      Item: {
        id: randomUUID(), subject, action, actor, createdAt: now, updatedAt: now, __typename: 'NfcHistory',
        before: previous ? JSON.stringify(previous) : null, after: JSON.stringify(record),
      },
    } });
    saved.push(nfcChangeSchema.parse({ ...change, record }));
  }
  for (const license of activeLicenses) {
    const matches: Record<string, unknown>[] = [];
    let start: Record<string, unknown> | undefined;
    do {
      const page = await client.send(new ScanCommand({
        TableName: table('Member'), ConsistentRead: true, ExclusiveStartKey: start,
        FilterExpression: 'license_number = :license', ExpressionAttributeValues: { ':license': license },
      }));
      matches.push(...(page.Items ?? []));
      start = page.LastEvaluatedKey;
    } while (start);
    if (matches.length !== 1 || matches[0]['lifecycleStatus'] !== 'ACTIVE') {
      throw new Error('Licence inconnue, ambiguë ou titulaire non actif.');
    }
    writes.push({ ConditionCheck: {
      TableName: table('Member'), Key: { id: matches[0]['id'] },
      ConditionExpression: 'lifecycleStatus = :active AND license_number = :license',
      ExpressionAttributeValues: { ':active': 'ACTIVE', ':license': license },
    } });
  }
  await client.send(new TransactWriteCommand({ TransactItems: writes }));
  return saved;
}

export const handler: Schema['manageNfc']['functionHandler'] = async event => {
  try {
    const identity = event.identity;
    if (!identity || !('sub' in identity) || !('claims' in identity)) throw new Error('Authentification requise.');
    const groups: unknown = identity.claims['cognito:groups'];
    if (!Array.isArray(groups) || !groups.some(group => group === 'Systeme' || group === 'Administrateur')) {
      throw new Error('Accès NFC réservé aux administrateurs.');
    }
    const input: unknown = typeof event.arguments.input === 'string'
      ? JSON.parse(event.arguments.input) : event.arguments.input;
    return JSON.stringify(await commitNfc(input, identity.sub));
  } catch (error) {
    console.error('[NFC persistence]', error instanceof Error ? error.name : 'UnknownError');
    if (error instanceof Error && error.name === 'TransactionCanceledException') {
      throw new Error('Une donnée a changé ou une condition d’écriture n’est plus satisfaite. Actualisez puis réessayez.');
    }
    throw error;
  }
};
