import assert from 'node:assert/strict';
import { afterEach, test, mock } from 'node:test';
import { GetCommand, ScanCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { client, commitNfc } from './handler';

for (const model of ['Member', 'MemberNfcCard', 'NfcCardRequest', 'NfcHistory', 'NfcImportBatch']) {
  process.env[`${model}_TABLE`] = model;
}
afterEach(() => mock.restoreAll());
const now = '2026-11-14T10:00:00.000Z';
const card = {
  uid: '04E50142E37384', licenseNumber: '00123456', kind: 'WHITE', stockState: 'ASSIGNED',
  status: 'ACTIVE', assignedAt: now, assignedBy: 'client', createdAt: now, updatedAt: now,
};

test('writes card and audit atomically with a member condition and server identity', async () => {
  let transaction: TransactWriteCommand | undefined;
  mock.method(client, 'send', async (command: unknown) => {
    if (command instanceof GetCommand) return {};
    if (command instanceof ScanCommand) return { Items: [{ id: 'one', license_number: card.licenseNumber, lifecycleStatus: 'ACTIVE' }] };
    if (command instanceof TransactWriteCommand) { transaction = command; return {}; }
    throw new Error('Unexpected command');
  });
  const saved = await commitNfc({ action: 'ASSIGN', changes: [{ entity: 'card', expectedVersion: null, record: card }] }, 'trusted');
  assert.equal(saved[0].entity, 'card');
  const writes = transaction!.input.TransactItems!;
  assert.equal(writes.length, 3);
  assert.equal(writes[0].Put?.Item?.['assignedBy'], 'trusted');
  assert.equal(writes[0].Put?.ConditionExpression, 'attribute_not_exists(#key)');
  assert.equal(writes[1].Put?.Item?.['actor'], 'trusted');
  assert.equal(writes[2].ConditionCheck?.TableName, 'Member');
});

test('rejects stale versions and a disabled white-card transfer before any write', async () => {
  mock.method(client, 'send', async (command: unknown) => {
    if (command instanceof GetCommand) return { Item: { ...card, status: 'DISABLED' } };
    throw new Error('No writes expected');
  });
  await assert.rejects(commitNfc({
    action: 'ASSIGN', changes: [{ entity: 'card', expectedVersion: 'stale', record: card }],
  }, 'trusted'), /concurrente/);
  await assert.rejects(commitNfc({
    action: 'ASSIGN', changes: [{ entity: 'card', expectedVersion: now, record: { ...card, licenseNumber: '00876543' } }],
  }, 'trusted'), /Transfert interdit/);
});

test('rejects inactive holders and propagates transaction failures', async () => {
  let active = false;
  mock.method(client, 'send', async (command: unknown) => {
    if (command instanceof GetCommand) return {};
    if (command instanceof ScanCommand) return { Items: [{ id: 'one', lifecycleStatus: active ? 'ACTIVE' : 'BANNED' }] };
    if (command instanceof TransactWriteCommand) throw new Error('TransactionCanceledException');
    throw new Error('Unexpected command');
  });
  const input = { action: 'ASSIGN', changes: [{ entity: 'card', expectedVersion: null, record: card }] };
  await assert.rejects(commitNfc(input, 'trusted'), /non actif/);
  active = true;
  await assert.rejects(commitNfc(input, 'trusted'), /TransactionCanceledException/);
});

test('clears the sparse licence index on return while preserving the former holder in audit', async () => {
  let transaction: TransactWriteCommand | undefined;
  mock.method(client, 'send', async (command: unknown) => {
    if (command instanceof GetCommand) return { Item: card };
    if (command instanceof TransactWriteCommand) { transaction = command; return {}; }
    throw new Error('Unexpected command');
  });
  await commitNfc({
    action: 'RETURN', changes: [{
      entity: 'card', expectedVersion: now,
      record: { ...card, status: 'DISABLED', stockState: 'AVAILABLE', licenseNumber: null, assignedAt: null, assignedBy: null },
    }],
  }, 'trusted');
  assert.equal(transaction!.input.TransactItems![0].Put?.Item?.['licenseNumber'], undefined);
  assert.equal(JSON.parse(transaction!.input.TransactItems![1].Put?.Item?.['before']).licenseNumber, card.licenseNumber);
});
