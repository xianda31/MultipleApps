import assert from 'node:assert/strict';
import test from 'node:test';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { AdvanceRequest, AdvanceTables, createAdvanceTransaction as createTransaction, getPreviousAdvances } from './transaction';

const tables: AdvanceTables = {
  advances: 'advances', advanceParticipants: 'advanceParticipants',
  games: 'games', settlements: 'settlements',
  members: 'members', products: 'products', entries: 'entries', playBooks: 'playBooks',
};
const request: AdvanceRequest = {
  operationId: 'operation-1', gameId: 'game', season: '2026/2027', buyerId: 'buyer', coBuyerId: 'partner',
  productId: 'card', priceCents: 3000, accepted: true,
};
const now = new Date('2026-11-22T10:00:00.000Z');

function createAdvanceTransaction(
  client: DynamoDBDocumentClient, advanceTables: AdvanceTables, input: AdvanceRequest, date: Date,
  initializedSeason = request.season,
) {
  return createTransaction(client, advanceTables, input, date, initializedSeason);
}

function fixture() {
  const data = new Map<string, Map<string, Record<string, unknown>>>();
  for (const table of Object.values(tables)) data.set(table, new Map());
  const put = (table: string, id: string, item: Record<string, unknown>) => data.get(table)!.set(id, item);
  put(tables.members, 'buyer', {
    firstname: 'Jean', lastname: 'TEST', license_number: '00000001', lifecycleStatus: 'ACTIVE', updatedAt: 'v1',
  });
  put(tables.members, 'partner', {
    firstname: 'Anne', lastname: 'TEST', license_number: '00000002', lifecycleStatus: 'ACTIVE', updatedAt: 'v1',
  });
  put(tables.games, 'game', {
    season: request.season, updatedAt: 'v1',
    gamers: [{
      license: '00000001', firstname: 'Jean', lastname: 'TEST', is_member: true, validated: false,
      enabled: true, in_euro: false, index: 0, price: 3, game_credits: 0, debt: 0, credit: 0,
      member_id: 'buyer', my_birthday: null, photo_url$: null,
    }],
  });
  put(tables.products, 'card', { account: 'CAR', paired: false, active: true, price: 30, updatedAt: 'v1' });
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'eu-west-3' }));
  let loseResponse = false;
  let beforeTransaction: (() => void) | undefined;
  const send = async (command: unknown) => {
    if (command instanceof GetCommand) {
      const key = command.input.Key!;
      return { Item: data.get(command.input.TableName!)!.get(String(key['id'] ?? key['gameId'])) };
    }
    if (command instanceof TransactWriteCommand) {
      beforeTransaction?.();
      for (const item of command.input.TransactItems!) {
        const action = item.ConditionCheck ?? item.Put!;
        const key = item.ConditionCheck?.Key ?? item.Put!.Item!;
        const id = String(key['id'] ?? key['gameId']);
        const current = data.get(action.TableName!)!.get(id);
        const condition = action.ConditionExpression!;
        if ((condition.startsWith('attribute_not_exists') && current)
          || (item.Put?.TableName === tables.advanceParticipants && !condition.startsWith('attribute_not_exists')
            && (current?.['revision'] !== action.ExpressionAttributeValues?.[':revision']
              || current?.['lastOperationId'] !== action.ExpressionAttributeValues?.[':previous']))
          || (condition === 'updatedAt = :version'
            && current?.['updatedAt'] !== action.ExpressionAttributeValues?.[':version'])
          || (item.ConditionCheck?.TableName === tables.games
            && (current?.['updatedAt'] !== action.ExpressionAttributeValues?.[':version']
              || (condition.includes('attribute_not_exists(playersVersion)')
                ? current?.['playersVersion'] != null
                : current?.['playersVersion'] !== action.ExpressionAttributeValues?.[':playersVersion'])))) {
          const error = new Error('transaction cancelled');
          error.name = 'TransactionCanceledException';
          throw error;
        }
      }
      for (const item of command.input.TransactItems!) {
        if (!item.Put) continue;
        const entry = item.Put.Item!;
        put(item.Put.TableName!, String(entry['id']), entry);
      }
      if (loseResponse) throw new Error('response lost');
      return {};
    }
    throw new Error('Unexpected database command');
  };
  client.send = send as typeof client.send;
  return {
    client, data, put,
    loseResponse: () => { loseResponse = true; },
    beforeTransaction: (callback: () => void) => { beforeTransaction = callback; },
  };
}

test('creates balanced debt and shared PlayBook once, including replay after a lost response', async () => {
  const f = fixture();
  f.loseResponse();
  const result = await createAdvanceTransaction(f.client, tables, request, now);
  assert.equal(result.replayed, true);
  const entry = f.data.get(tables.entries)!.get(result.bookEntryId)!;
  assert.deepEqual(entry['amounts'], { cashbox_in: 0 });
  assert.deepEqual(entry['operations'], [
    { label: 'avance carte de jeu', member: 'TEST Jean', values: { CAR: 30, creance_in: 30 } },
    { label: 'avance carte de jeu (co-acheteur)', member: 'TEST Anne', values: { CAR: 0 } },
  ]);
  const card = f.data.get(tables.playBooks)!.get(result.playBookId)!;
  assert.equal(card['bookEntry_id'], result.bookEntryId);
  assert.deepEqual(card['licenses'], ['00000001', '00000002']);
  const second = await createAdvanceTransaction(f.client, tables, request, now);
  assert.deepEqual(second, result);
  assert.equal(f.data.get(tables.entries)!.size, 1);
  assert.equal(f.data.get(tables.playBooks)!.size, 1);
  await assert.rejects(
    createAdvanceTransaction(f.client, tables, { ...request, coBuyerId: undefined }, now),
    /paramètres différents/,
  );
});

test('rejects duplicate registrations for the holder without writing', async () => {
  const f = fixture();
  const game = f.data.get(tables.games)!.get('game')!;
  const gamers = game['gamers'] as Record<string, unknown>[];
  game['gamers'] = [gamers[0], { ...gamers[0] }];
  await assert.rejects(createAdvanceTransaction(f.client, tables, request, now), /plusieurs inscriptions/);
  assert.equal(f.data.get(tables.advances)!.size, 0);
  assert.equal(f.data.get(tables.entries)!.size, 0);
  assert.equal(f.data.get(tables.playBooks)!.size, 0);
});

test('rejects a registration whose member ID does not match the card holder', async () => {
  const f = fixture();
  const game = f.data.get(tables.games)!.get('game')!;
  (game['gamers'] as Record<string, unknown>[])[0]['member_id'] = 'another-member';
  await assert.rejects(createAdvanceTransaction(f.client, tables, request, now), /identité du titulaire/);
  assert.equal(f.data.get(tables.entries)!.size, 0);
});

test('simultaneous identical requests produce one entry and card', async () => {
  const f = fixture();
  const results = await Promise.all([
    createAdvanceTransaction(f.client, tables, request, now),
    createAdvanceTransaction(f.client, tables, request, now),
  ]);
  assert.equal(results[0].bookEntryId, results[1].bookEntryId);
  assert.equal(results[0].playBookId, results[1].playBookId);
  assert.equal(results.filter(result => result.replayed).length, 1);
  assert.equal(f.data.get(tables.entries)!.size, 1);
  assert.equal(f.data.get(tables.playBooks)!.size, 1);
});

test('requires confirmation of previous advances before a new operation, while replay remains idempotent', async () => {
  const f = fixture();
  const first = await createAdvanceTransaction(f.client, tables, request, now);
  const previous = await getPreviousAdvances(f.client, tables, request.gameId, ['buyer', 'partner']);
  assert.deepEqual(previous, [
    { memberId: 'buyer', operationId: 'operation-1' },
    { memberId: 'partner', operationId: 'operation-1' },
  ]);
  const secondRequest = { ...request, operationId: 'operation-2' };
  await assert.rejects(createAdvanceTransaction(f.client, tables, secondRequest, now), /confirmez une nouvelle avance/);
  assert.equal(f.data.get(tables.entries)!.size, 1);
  const second = await createAdvanceTransaction(f.client, tables, {
    ...secondRequest, confirmedPreviousAdvanceIds: ['operation-1'],
  }, now);
  assert.notEqual(second.bookEntryId, first.bookEntryId);
  assert.equal(f.data.get(tables.entries)!.size, 2);
  assert.equal(f.data.get(tables.playBooks)!.size, 2);
  const replay = await createAdvanceTransaction(f.client, tables, request, now);
  assert.equal(replay.bookEntryId, first.bookEntryId);
  assert.equal(replay.replayed, true);
  await assert.rejects(createAdvanceTransaction(f.client, tables, {
    ...request, operationId: 'operation-3', confirmedPreviousAdvanceIds: ['operation-1'],
  }, now), /confirmez une nouvelle avance/);
});

test('does not silently repeat an advance for the co-holder of a different purchaser', async () => {
  const f = fixture();
  await createAdvanceTransaction(f.client, tables, { ...request, coBuyerId: undefined }, now);
  f.put(tables.members, 'another', {
    firstname: 'Luc', lastname: 'TEST', license_number: '00000003', lifecycleStatus: 'ACTIVE', updatedAt: 'v1',
  });
  const game = f.data.get(tables.games)!.get('game')!;
  const original = (game['gamers'] as Record<string, unknown>[])[0];
  game['gamers'] = [original, { ...original, license: '00000003', member_id: 'another' }];
  const another = { ...request, operationId: 'operation-2', buyerId: 'another', coBuyerId: 'buyer' };
  await assert.rejects(createAdvanceTransaction(f.client, tables, another, now), /confirmez une nouvelle avance/);
  const result = await createAdvanceTransaction(f.client, tables, {
    ...another, confirmedPreviousAdvanceIds: ['operation-1'],
  }, now);
  assert.equal(f.data.get(tables.playBooks)!.get(result.playBookId)!['bookEntry_id'], result.bookEntryId);
});

test('requires acknowledgement of both holders’ different previous advances', async () => {
  const f = fixture();
  await createAdvanceTransaction(f.client, tables, { ...request, coBuyerId: undefined }, now);
  const game = f.data.get(tables.games)!.get('game')!;
  const original = (game['gamers'] as Record<string, unknown>[])[0];
  game['gamers'] = [original, { ...original, license: '00000002', member_id: 'partner' }];
  await createAdvanceTransaction(f.client, tables, {
    ...request, operationId: 'operation-2', buyerId: 'partner', coBuyerId: undefined,
  }, now);
  const third = { ...request, operationId: 'operation-3' };
  await assert.rejects(createAdvanceTransaction(f.client, tables, {
    ...third, confirmedPreviousAdvanceIds: ['operation-1'],
  }, now), /confirmez une nouvelle avance/);
  await createAdvanceTransaction(f.client, tables, {
    ...third, confirmedPreviousAdvanceIds: ['operation-2', 'operation-1'],
  }, now);
  assert.equal(f.data.get(tables.entries)!.size, 3);
});

test('rejects a previous confirmation if another advance wins the race before commit', async () => {
  const f = fixture();
  await createAdvanceTransaction(f.client, tables, request, now);
  f.beforeTransaction(() => {
    for (const group of f.data.get(tables.advanceParticipants)!.values()) {
      group['revision'] = 2;
      group['lastOperationId'] = 'another-operation';
    }
  });
  await assert.rejects(createAdvanceTransaction(f.client, tables, {
    ...request, operationId: 'operation-2', confirmedPreviousAdvanceIds: ['operation-1'],
  }, now), /transaction cancelled/);
  assert.equal(f.data.get(tables.entries)!.size, 1);
});

test('only one of two simultaneous distinct advances succeeds without a second confirmation', async () => {
  const f = fixture();
  const results = await Promise.allSettled([
    createAdvanceTransaction(f.client, tables, request, now),
    createAdvanceTransaction(f.client, tables, { ...request, operationId: 'operation-2' }, now),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  assert.equal(f.data.get(tables.entries)!.size, 1);
  assert.equal(f.data.get(tables.playBooks)!.size, 1);
});

test('does not report success when a committed card is missing', async () => {
  const f = fixture();
  const result = await createAdvanceTransaction(f.client, tables, request, now);
  f.data.get(tables.playBooks)!.delete(result.playBookId);
  await assert.rejects(createAdvanceTransaction(f.client, tables, request, now), /incomplète/);
  await assert.rejects(getPreviousAdvances(f.client, tables, request.gameId, ['buyer']), /incomplète/);
  await assert.rejects(createAdvanceTransaction(f.client, tables, {
    ...request, operationId: 'operation-2', confirmedPreviousAdvanceIds: ['operation-1'],
  }, now), /incomplète/);
});

test('rejects a stale product, missing consent, closed season and changed roster without writes', async () => {
  const f = fixture();
  await assert.rejects(createAdvanceTransaction(f.client, tables, { ...request, accepted: false }, now), /non acceptée/);
  await assert.rejects(createAdvanceTransaction(f.client, tables, { ...request, season: '2025/2026' }, now), /saison comptable/);
  await assert.rejects(createAdvanceTransaction(f.client, tables, { ...request, priceCents: 2900 }, now), /prix/);
  f.beforeTransaction(() => {
    const game = f.data.get(tables.games)!.get('game')!;
    game['updatedAt'] = 'v2';
  });

  await assert.rejects(createAdvanceTransaction(f.client, tables, request, now), /transaction cancelled/);
  assert.equal(f.data.get(tables.entries)!.size, 0);
  assert.equal(f.data.get(tables.playBooks)!.size, 0);
});

test('rejects a roster update with the same timestamp but a new playersVersion', async () => {
  const f = fixture();
  f.data.get(tables.games)!.get('game')!['playersVersion'] = 1;
  f.beforeTransaction(() => { f.data.get(tables.games)!.get('game')!['playersVersion'] = 2; });
  await assert.rejects(createAdvanceTransaction(f.client, tables, request, now), /transaction cancelled/);
  assert.equal(f.data.get(tables.entries)!.size, 0);
  assert.equal(f.data.get(tables.playBooks)!.size, 0);
});

test('accepts a legacy roster whose playersVersion is explicitly null', async () => {
  const f = fixture();
  f.data.get(tables.games)!.get('game')!['playersVersion'] = null;
  const result = await createAdvanceTransaction(f.client, tables, request, now);
  assert.equal(result.replayed, false);
});

test('rejects a missing or different initialized accounting season without writing', async () => {
  for (const season of ['', '2025/2026']) {
    const f = fixture();
    await assert.rejects(createAdvanceTransaction(f.client, tables, request, now, season), /saison comptable/);
    assert.equal(f.data.get(tables.entries)!.size, 0);
    assert.equal(f.data.get(tables.playBooks)!.size, 0);
  }
});

test('uses the Paris accounting date and season at the July boundary', async () => {
  const f = fixture();
  await assert.rejects(createAdvanceTransaction(f.client, tables, request, new Date('2026-06-30T21:59:59Z')), /saison comptable/);
  const result = await createAdvanceTransaction(f.client, tables, request, new Date('2026-06-30T22:00:00Z'));
  assert.equal(f.data.get(tables.entries)!.get(result.bookEntryId)!['date'], '2026-07-01');
});

test('replays a committed advance after the accounting season has closed', async () => {
  const f = fixture();
  const result = await createAdvanceTransaction(f.client, tables, request, now);
  const replay = await createAdvanceTransaction(f.client, tables, request, new Date('2027-07-01T10:00:00Z'), '2027/2028');
  assert.equal(replay.bookEntryId, result.bookEntryId);
  assert.equal(replay.replayed, true);
});
