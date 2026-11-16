import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import type { Schema } from '../../data/resource';
import type { Gamer, GameCheckIn, GamePlayersAction } from '../../../projects/admin/src/app/back/fees/fees.interface';
import { changePairPlayers, decodeGamePlayers, gamerPairs, rosterSignature, isStoredGamer } from '../../../projects/admin/src/app/back/fees/fees-collector/fees-pairs.util';

export const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPlayer(value: unknown): value is Gamer {
  return isStoredGamer(value);
}

function isGame(value: Record<string, unknown>): value is Schema['Game']['type'] {
  return ['gameId', 'season', 'fee_rate', 'createdAt', 'updatedAt'].every(key => typeof value[key] === 'string')
    && typeof value['member_trn_price'] === 'number' && typeof value['non_member_trn_price'] === 'number'
    && typeof value['fees_doubled'] === 'boolean' && typeof value['alphabetic_sort'] === 'boolean'
    && (value['playersVersion'] == null || (Number.isInteger(value['playersVersion']) && Number(value['playersVersion']) >= 0));
}

function isAction(value: unknown): value is GamePlayersAction {
  if (!isRecord(value)) return false;
  switch (value['type']) {
    case 'add': return Array.isArray(value['players']) && value['players'].every(isPlayer);
    case 'remove': return typeof value['pairId'] === 'string';
    case 'replace': return typeof value['license'] === 'string' && isPlayer(value['player']);
    case 'check-in': return typeof value['license'] === 'string'
      && ['card', 'euro', 'none', 'unpointed'].includes(String(value['mode']))
      && ['manual', 'nfc'].includes(String(value['source']))
      && (value['expectedVersion'] === null || typeof value['expectedVersion'] === 'string');
    default: return false;
  }
}

export const handler: Schema['mutateGamePlayers']['functionHandler'] = async event => {
  const action: unknown = typeof event.arguments.action === 'string'
    ? JSON.parse(event.arguments.action) : event.arguments.action;
  if (!isAction(action)) throw new Error('Modification de liste invalide.');
  const user = event.identity && 'username' in event.identity ? event.identity.username : 'unknown';
  return mutatePlayers(event.arguments.gameId, action, event.arguments.expectedRoster, user);
};

export async function mutatePlayers(
  gameId: string, action: GamePlayersAction, expectedRoster: string | null | undefined, user: string,
): Promise<Schema['Game']['type']> {
  const gameTable = process.env['GAME_TABLE_NAME'];
  const checkInTable = process.env['GAME_CHECK_IN_TABLE_NAME'];
  const settlementTable = process.env['GAME_SETTLEMENT_TABLE_NAME'];
  if (!gameTable || !checkInTable || !settlementTable) throw new Error('Tournament tables are not configured.');

  for (let attempt = 0; attempt < 3; attempt++) {
    const { Item: stored } = await documentClient.send(new GetCommand({
      TableName: gameTable, Key: { gameId }, ConsistentRead: true,
    }));
    if (!stored) throw new Error('La liste du tournoi doit être enregistrée avant modification.');
    if (!isGame(stored)) throw new Error('La configuration enregistrée du tournoi est invalide.');
    let players = decodeGamePlayers(stored['gamers']);
    const { Item: settlement } = await documentClient.send(new GetCommand({
      TableName: settlementTable, Key: { gameId }, ConsistentRead: true,
    }));
    if (settlement) throw new Error('Le tournoi est en cours de clôture ou déjà clôturé.');
    if (action.type !== 'check-in' && expectedRoster !== rosterSignature(players)) {
      throw new Error('La liste a changé sur un autre poste. Actualisez-la puis réessayez.');
    }
    const affected = action.type === 'remove'
      ? gamerPairs(players).find(pair => pair.id === action.pairId)?.players.map(player => player.license) ?? []
      : action.type === 'add' ? action.players.map(player => player.license)
        : action.type === 'replace' ? [action.license, action.player.license] : [action.license];
    const checkIns = new Map<string, GameCheckIn | undefined>();
    const checkInCreationDates = new Map<string, string>();
    for (const license of affected) {
      const { Item } = await documentClient.send(new GetCommand({
        TableName: checkInTable, Key: { gameId, license }, ConsistentRead: true,
      }));
      let checkIn: GameCheckIn | undefined;
      if (Item) {
        const mode: unknown = Item['mode'];
        const source: unknown = Item['source'];
        if ((mode !== 'card' && mode !== 'euro' && mode !== 'none' && mode !== 'unpointed')
          || (source !== 'manual' && source !== 'nfc') || typeof Item['updatedAt'] !== 'string'
          || typeof Item['updatedBy'] !== 'string') throw new Error('Le pointage enregistré est invalide.');
        checkIn = { gameId, license, mode, source, updatedBy: Item['updatedBy'], updatedAt: Item['updatedAt'] };
        if (typeof Item['createdAt'] === 'string') checkInCreationDates.set(license, Item['createdAt']);
      }
      checkIns.set(license, checkIn);
      if (checkIn) players = players.map(player => player.license === license
        ? { ...player, validated: checkIn.mode !== 'unpointed', enabled: checkIn.mode !== 'none',
          in_euro: checkIn.mode === 'euro' } : player);
    }
    const now = new Date(Math.max(Date.now(),
      ...[...checkIns.values()].map(item => item?.updatedAt ? Date.parse(item.updatedAt) + 1 : 0))).toISOString();
    let checkIn: GameCheckIn | undefined;
    if (action.type === 'check-in') {
      const player = players.find(candidate => candidate.license === action.license);
      if (!player) throw new Error('Ce joueur n’est plus inscrit dans ce tournoi.');
      const previous = checkIns.get(action.license);
      if ((previous?.updatedAt ?? null) !== action.expectedVersion) throw new Error('Le pointage a changé sur un autre poste.');
      if (action.source === 'nfc' && (action.mode !== 'card'
        || (player.validated && previous?.source === 'manual' && previous.mode !== 'card'))) {
        throw new Error('Le pointage NFC ne peut pas remplacer ce règlement manuel.');
      }
      checkIn = { gameId, license: action.license, mode: action.mode, source: action.source, updatedBy: user, updatedAt: now };
      players = players.map(candidate => candidate.license === action.license ? {
        ...candidate, validated: action.mode !== 'unpointed', enabled: action.mode !== 'none',
        in_euro: action.mode === 'euro', check_in_source: action.source,
        check_in_updated_by: user, check_in_updated_at: now,
      } : candidate);
    } else {
      for (const license of affected) {
        if (checkIns.get(license) && checkIns.get(license)!.mode !== 'unpointed') {
          throw new Error('Un joueur concerné est déjà pointé. Dépointez-le avant de modifier la paire.');
        }
      }
      players = changePairPlayers(players, action, randomUUID());
      players = players.map(player => {
        const previous = checkIns.get(player.license);
        return previous ? { ...player, check_in_updated_at: previous.updatedAt,
          check_in_source: previous.source, check_in_updated_by: previous.updatedBy } : player;
      });
    }
    const version: number = stored['playersVersion'] ?? 0;
    const next = { ...stored, gamers: players.map(player => ({ ...player, photo_url$: null })),
      playersVersion: version + 1, updatedAt: now };
    const items: NonNullable<ConstructorParameters<typeof TransactWriteCommand>[0]['TransactItems']> = [
      { ConditionCheck: { TableName: settlementTable, Key: { gameId }, ConditionExpression: 'attribute_not_exists(gameId)' } },
      { Update: {
        TableName: gameTable, Key: { gameId },
        UpdateExpression: 'SET gamers = :players, playersVersion = :next, updatedAt = :now',
        ConditionExpression: stored['playersVersion'] == null ? 'attribute_not_exists(playersVersion)' : 'playersVersion = :previous',
        ExpressionAttributeValues: { ':players': next.gamers, ':next': next.playersVersion, ':now': now,
          ...(stored['playersVersion'] == null ? {} : { ':previous': version }) },
      } },
    ];
    for (const [license, previous] of checkIns) {
      const condition = previous ? 'updatedAt = :stamp' : 'attribute_not_exists(gameId)';
      const values = previous ? { ':stamp': previous.updatedAt } : undefined;
      if (checkIn && license === checkIn.license) {
        items.push({ Put: {
          TableName: checkInTable, Item: { ...checkIn, createdAt: checkInCreationDates.get(license) ?? now, __typename: 'GameCheckIn' },
          ConditionExpression: condition, ExpressionAttributeValues: values,
        } });
      } else {
        items.push({ ConditionCheck: {
          TableName: checkInTable, Key: { gameId, license },
          ConditionExpression: condition, ExpressionAttributeValues: values,
        } });
      }
    }
    try {
      await documentClient.send(new TransactWriteCommand({ TransactItems: items }));
      return next;
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'TransactionCanceledException' || attempt === 2) throw error;
    }
  }
  throw new Error('La liste a changé pendant la modification. Réessayez.');
}
