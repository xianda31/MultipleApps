import { createHash } from 'node:crypto';
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { decodeGamePlayers } from '../../../projects/admin/src/app/back/fees/fees-collector/fees-pairs.util';
import { MAX_STAMPS } from '../../../projects/admin/src/app/back/game-cards/game-card.interface';

export interface AdvanceRequest {
  operationId: string;
  gameId: string;
  season: string;
  buyerId: string;
  coBuyerId?: string;
  productId: string;
  priceCents: number;
  accepted: boolean;
  confirmedPreviousAdvanceIds?: string[];
}

export interface AdvanceTables {
  advances: string;
  advanceParticipants: string;
  games: string;
  settlements: string;
  members: string;
  products: string;
  entries: string;
  playBooks: string;
}

export interface AdvanceResult {
  bookEntryId: string;
  playBookId: string;
  replayed: boolean;
}

export interface PreviousAdvance {
  memberId: string;
  operationId: string;
}

function stableId(prefix: string, value: string): string {
  return `${prefix}-${createHash('sha256').update(value).digest('hex')}`;
}

function requestFingerprint(request: AdvanceRequest): string {
  return stableId('parameters', JSON.stringify([
    request.gameId, request.season, request.buyerId, request.coBuyerId ?? null,
    request.productId, request.priceCents,
  ]));
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function accountingDateAt(now: Date): { date: string; season: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;
  if (!year || !month || !day) throw new Error('Date comptable indisponible.');
  const start = Number(year) - (Number(month) < 7 ? 1 : 0);
  return { date: `${year}-${month}-${day}`, season: `${start}/${start + 1}` };
}

async function getRecord(client: DynamoDBDocumentClient, table: string, key: Record<string, string>) {
  const result = await client.send(new GetCommand({ TableName: table, Key: key, ConsistentRead: true }));
  return result.Item;
}

function participantKey(gameId: string, memberId: string): string {
  return stableId('advance-holder', JSON.stringify([gameId, memberId]));
}

async function readPreviousAdvances(
  client: DynamoDBDocumentClient, tables: AdvanceTables, gameId: string, memberIds: string[],
): Promise<Array<{ memberId: string; operationId: string; revision: number }>> {
  const records = await Promise.all(memberIds.map(memberId =>
    getRecord(client, tables.advanceParticipants, { id: participantKey(gameId, memberId) })));
  const previous: Array<{ memberId: string; operationId: string; revision: number }> = [];
  for (const [index, record] of records.entries()) {
    if (!record) continue;
    if (record['gameId'] !== gameId || record['memberId'] !== memberIds[index]
      || !validId(record['lastOperationId']) || !Number.isSafeInteger(record['revision'])
      || Number(record['revision']) < 1 || Number(record['revision']) >= Number.MAX_SAFE_INTEGER) {
      throw new Error('Historique des avances invalide. Contactez un responsable.');
    }
    const advance = await getRecord(client, tables.advances, { id: stableId('advance', record['lastOperationId']) });
    if (!advance || advance['gameId'] !== gameId || advance['operationId'] !== record['lastOperationId']
      || !validId(advance['fingerprint']) || !Array.isArray(advance['memberIds'])
      || !advance['memberIds'].includes(memberIds[index])) {
      throw new Error('Historique des avances incomplet. Contactez un responsable.');
    }
    await replay(client, tables, advance, advance['fingerprint']);
    previous.push({ memberId: memberIds[index], operationId: record['lastOperationId'], revision: Number(record['revision']) });
  }
  return previous;
}

export async function getPreviousAdvances(
  client: DynamoDBDocumentClient, tables: AdvanceTables, gameId: string, memberIds: string[],
): Promise<PreviousAdvance[]> {
  if (!validId(gameId) || memberIds.length < 1 || memberIds.length > 2
    || memberIds.some(id => !validId(id)) || new Set(memberIds).size !== memberIds.length) {
    throw new Error('Titulaires ou tournoi invalides.');
  }
  return (await readPreviousAdvances(client, tables, gameId, memberIds))
    .map(({ memberId, operationId }) => ({ memberId, operationId }));
}

async function replay(
  client: DynamoDBDocumentClient, tables: AdvanceTables, record: Record<string, unknown>, fingerprint: string,
): Promise<AdvanceResult> {
  if (record['fingerprint'] !== fingerprint) {
    throw new Error('Une avance existe déjà pour ce titulaire et ce tournoi avec des paramètres différents.');
  }
  if (!validId(record['bookEntryId']) || !validId(record['playBookId'])) {
    throw new Error('Le résultat de l’avance enregistrée est invalide.');
  }
  const [entry, card] = await Promise.all([
    getRecord(client, tables.entries, { id: record['bookEntryId'] }),
    getRecord(client, tables.playBooks, { id: record['playBookId'] }),
  ]);
  if (!entry || !card || card['bookEntry_id'] !== record['bookEntryId']) {
    throw new Error('L’avance enregistrée est incomplète. Contactez un responsable.');
  }
  return { bookEntryId: record['bookEntryId'], playBookId: record['playBookId'], replayed: true };
}

function memberDetails(member: Record<string, unknown> | undefined): { name: string; license: string; updatedAt: string } {
  if (!member || member['lifecycleStatus'] !== 'ACTIVE'
    || !validId(member['firstname']) || !validId(member['lastname'])
    || !validId(member['license_number']) || !validId(member['updatedAt'])) {
    throw new Error('Un titulaire est introuvable, inactif ou ne possède pas de licence valide.');
  }
  return {
    name: `${member['lastname']} ${member['firstname']}`,
    license: member['license_number'].trim(),
    updatedAt: member['updatedAt'],
  };
}

/**
 * The caller must enforce authorization, load the initialized season from server
 * configuration, and publish/reconcile changes.
 * Season closure and other sales must not run concurrently with an advance.
 */
export async function createAdvanceTransaction(
  client: DynamoDBDocumentClient,
  tables: AdvanceTables,
  request: AdvanceRequest,
  now: Date,
  initializedSeason: string,
): Promise<AdvanceResult> {
  if (!validId(request.operationId) || request.operationId.trim() !== request.operationId
    || !validId(request.gameId) || !validId(request.season) || !validId(request.buyerId)
    || !validId(request.productId) || (request.coBuyerId !== undefined && !validId(request.coBuyerId))
    || request.coBuyerId === request.buyerId || request.accepted !== true
    || (request.confirmedPreviousAdvanceIds !== undefined
      && (!Array.isArray(request.confirmedPreviousAdvanceIds)
        || request.confirmedPreviousAdvanceIds.some(id => !validId(id))
        || new Set(request.confirmedPreviousAdvanceIds).size !== request.confirmedPreviousAdvanceIds.length))
    || !Number.isSafeInteger(request.priceCents) || request.priceCents < 0
    || !Number.isFinite(now.getTime())) {
    throw new Error('Demande d’avance invalide ou non acceptée.');
  }
  const markerId = stableId('advance', request.operationId);
  const fingerprint = requestFingerprint(request);
  const existing = await getRecord(client, tables.advances, { id: markerId });
  if (existing) return replay(client, tables, existing, fingerprint);
  const accountingDate = accountingDateAt(now);
  const memberIds = [request.buyerId, ...(request.coBuyerId ? [request.coBuyerId] : [])];
  const [game, buyerRecord, coBuyerRecord, product, previous] = await Promise.all([
    getRecord(client, tables.games, { gameId: request.gameId }),
    getRecord(client, tables.members, { id: request.buyerId }),
    request.coBuyerId ? getRecord(client, tables.members, { id: request.coBuyerId }) : Promise.resolve(undefined),
    getRecord(client, tables.products, { id: request.productId }),
    readPreviousAdvances(client, tables, request.gameId, memberIds),
  ]);
  const expectedPrevious = [...new Set(previous.map(item => item.operationId))].sort();
  const confirmedPrevious = [...(request.confirmedPreviousAdvanceIds ?? [])].sort();
  if (JSON.stringify(expectedPrevious) !== JSON.stringify(confirmedPrevious)) {
    throw new Error('Une avance existe déjà ou a changé pour un titulaire. Vérifiez et confirmez une nouvelle avance.');
  }
  if (!validId(initializedSeason) || initializedSeason !== request.season
    || request.season !== accountingDate.season) {
    throw new Error('La saison comptable n’est pas ouverte pour cette avance.');
  }
  const buyer = memberDetails(buyerRecord);
  const coBuyer = request.coBuyerId ? memberDetails(coBuyerRecord) : undefined;
  if (coBuyer && coBuyer.license === buyer.license) throw new Error('Les titulaires doivent être distincts.');
  if (!game || game['season'] !== request.season || !validId(game['updatedAt'])) {
    throw new Error('Le titulaire n’est pas inscrit au tournoi enregistré.');
  }
  if (game['playersVersion'] != null && (!Number.isSafeInteger(game['playersVersion']) || Number(game['playersVersion']) < 0)) {
    throw new Error('La version de la liste du tournoi est invalide.');
  }
  const registrations = decodeGamePlayers(game['gamers'])
    .filter(player => player.is_member && player.license.trim() === buyer.license);
  if (registrations.length === 0) throw new Error('Le titulaire n’est pas inscrit au tournoi enregistré.');
  if (registrations.length !== 1) throw new Error('Le titulaire possède plusieurs inscriptions au tournoi.');
  if (registrations[0].member_id !== request.buyerId) {
    throw new Error('L’identité du titulaire ne correspond pas à l’inscription du tournoi.');
  }
  if (!product || product['account'] !== 'CAR' || product['paired'] !== false || product['active'] !== true
    || typeof product['price'] !== 'number' || !Number.isFinite(product['price'])
    || product['price'] < 0 || Math.round(product['price'] * 100) !== request.priceCents
    || !validId(product['updatedAt'])) {
    throw new Error('Le prix ou le produit carte a changé. Actualisez avant de confirmer.');
  }

  const createdAt = now.toISOString();
  const bookEntryId = stableId('advance-entry', markerId);
  const playBookId = stableId('advance-card', markerId);
  const price = request.priceCents / 100;
  const members = [buyer, ...(coBuyer ? [coBuyer] : [])];
  const conditions = [
    { ConditionCheck: { TableName: tables.settlements, Key: { gameId: request.gameId }, ConditionExpression: 'attribute_not_exists(gameId)' } },
    { ConditionCheck: {
      TableName: tables.games, Key: { gameId: request.gameId },
      ConditionExpression: game['playersVersion'] == null
        ? 'updatedAt = :version AND (attribute_not_exists(playersVersion) OR attribute_type(playersVersion, :nullType))'
        : 'updatedAt = :version AND playersVersion = :playersVersion',
      ExpressionAttributeValues: { ':version': game['updatedAt'],
        ...(game['playersVersion'] == null ? { ':nullType': 'NULL' } : { ':playersVersion': game['playersVersion'] }) },
    } },
    { ConditionCheck: {
      TableName: tables.products, Key: { id: request.productId },
      ConditionExpression: 'updatedAt = :version', ExpressionAttributeValues: { ':version': product['updatedAt'] },
    } },
    ...members.map((member, index) => ({ ConditionCheck: {
      TableName: tables.members, Key: { id: index === 0 ? request.buyerId : request.coBuyerId! },
      ConditionExpression: 'updatedAt = :version',
      ExpressionAttributeValues: { ':version': member.updatedAt },
    } })),
  ];
  const writes = [
    { Put: {
      TableName: tables.advances,
      Item: { id: markerId, operationId: request.operationId, gameId: request.gameId, memberIds, fingerprint,
        bookEntryId, playBookId, createdAt, updatedAt: createdAt, __typename: 'CardAdvance' },
      ConditionExpression: 'attribute_not_exists(id)',
    } },
    ...memberIds.map(memberId => {
      const last = previous.find(item => item.memberId === memberId);
      return { Put: {
        TableName: tables.advanceParticipants,
        Item: { id: participantKey(request.gameId, memberId), gameId: request.gameId, memberId,
          lastOperationId: request.operationId, revision: (last?.revision ?? 0) + 1, updatedAt: createdAt },
        ConditionExpression: last ? 'revision = :revision AND lastOperationId = :previous' : 'attribute_not_exists(id)',
        ...(last ? { ExpressionAttributeValues: { ':revision': last.revision, ':previous': last.operationId } } : {}),
      } };
    }),
    { Put: {
      TableName: tables.entries,
      Item: {
        id: bookEntryId, season: request.season, date: accountingDate.date,
        transaction_id: 'achat_adhérent_en_espèces', amounts: { cashbox_in: 0 },
        operations: [
          { label: 'avance carte de jeu', member: buyer.name, values: { CAR: price, creance_in: price } },
          ...(coBuyer ? [{ label: 'avance carte de jeu (co-acheteur)', member: coBuyer.name, values: { CAR: 0 } }] : []),
        ],
        createdAt, updatedAt: createdAt, __typename: 'BookEntry',
      },
      ConditionExpression: 'attribute_not_exists(id)',
    } },
    { Put: {
      TableName: tables.playBooks,
      Item: {
        id: playBookId, initial_qty: MAX_STAMPS, licenses: members.map(member => member.license), stamps: [],
        manual_creation: false, bookEntry_id: bookEntryId, createdAt, updatedAt: createdAt, __typename: 'PlayBook',
      },
      ConditionExpression: 'attribute_not_exists(id)',
    } },
  ];
  try {
    await client.send(new TransactWriteCommand({ TransactItems: [...conditions, ...writes] }));
    return { bookEntryId, playBookId, replayed: false };
  } catch (error) {
    const saved = await getRecord(client, tables.advances, { id: markerId });
    if (saved) return replay(client, tables, saved, fingerprint);
    throw error;
  }
}
