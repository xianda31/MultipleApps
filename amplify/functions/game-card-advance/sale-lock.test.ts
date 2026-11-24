import assert from 'node:assert/strict';
import test from 'node:test';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { acquireSaleLocks, releaseSaleLocks } from './sale-lock';

const tables = { operations: 'operations', locks: 'locks' };
const now = new Date('2026-11-22T10:00:00.000Z');
const intentHash = 'a'.repeat(64);

function fixture() {
  const data = new Map<string, Map<string, Record<string, unknown>>>([
    [tables.operations, new Map()], [tables.locks, new Map()],
  ]);
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'eu-west-3' }));
  let loseResponse = false;
  client.send = (async (command: unknown) => {
    if (command instanceof GetCommand) {
      return { Item: data.get(command.input.TableName!)!.get(String(command.input.Key!['id'])) };
    }
    if (!(command instanceof TransactWriteCommand)) throw new Error('Unexpected database command');
    for (const item of command.input.TransactItems!) {
      const action = item.Put ?? item.Update ?? item.Delete!;
      const key = item.Put?.Item ?? item.Update?.Key ?? item.Delete!.Key!;
      const current = data.get(action.TableName!)!.get(String(key['id']));
      const values = action.ExpressionAttributeValues;
      const valid = item.Put ? !current : item.Update
        ? current?.['status'] === values?.[':held'] && current?.['fingerprint'] === values?.[':fingerprint']
        : current?.['operationId'] === values?.[':operationId'];
      if (!valid) throw new Error('transaction cancelled');
    }
    for (const item of command.input.TransactItems!) {
      if (item.Put) data.get(item.Put.TableName!)!.set(String(item.Put.Item!['id']), { ...item.Put.Item });
      if (item.Delete) data.get(item.Delete.TableName!)!.delete(String(item.Delete.Key!['id']));
      if (item.Update) {
        const record = data.get(item.Update.TableName!)!.get(String(item.Update.Key!['id']))!;
        record['status'] = item.Update.ExpressionAttributeValues![':outcome'];
      }
    }
    if (loseResponse) { loseResponse = false; throw new Error('response lost'); }
    return {};
  }) as typeof client.send;
  return { client, data, loseResponse: () => { loseResponse = true; } };
}

test('locks all holders atomically, supports replay after a lost response and blocks competing sales', async () => {
  const f = fixture();
  f.loseResponse();
  await acquireSaleLocks(f.client, tables, 'sale-1', ['buyer', 'partner'], intentHash, now);
  await acquireSaleLocks(f.client, tables, 'sale-1', ['partner', 'buyer'], intentHash, now);
  await assert.rejects(acquireSaleLocks(f.client, tables, 'sale-1', ['buyer'], intentHash, now), /autre demande/);
  await assert.rejects(acquireSaleLocks(f.client, tables, 'sale-1', ['buyer', 'partner'], 'b'.repeat(64), now), /autre demande/);
  await assert.rejects(acquireSaleLocks(f.client, tables, 'sale-2', ['other', 'partner'], intentHash, now), /transaction cancelled/);
  assert.equal(f.data.get(tables.locks)!.has('other'), false);
  assert.equal(f.data.get(tables.operations)!.has('sale-2'), false);
  assert.equal(f.data.get(tables.locks)!.size, 2);
});

test('holds uncertain sales until an explicit terminal outcome and releases only their own locks', async () => {
  const f = fixture();
  await acquireSaleLocks(f.client, tables, 'sale-1', ['buyer', 'partner'], intentHash, now);
  await assert.rejects(releaseSaleLocks(f.client, tables, 'sale-1', ['buyer'], intentHash, 'cancelled', now), /transaction cancelled/);
  await assert.rejects(releaseSaleLocks(f.client, tables, 'sale-2', ['buyer', 'partner'], intentHash, 'completed', now), /transaction cancelled/);
  assert.equal(f.data.get(tables.locks)!.size, 2);
  f.loseResponse();
  await releaseSaleLocks(f.client, tables, 'sale-1', ['buyer', 'partner'], intentHash, 'completed', now);
  await releaseSaleLocks(f.client, tables, 'sale-1', ['partner', 'buyer'], intentHash, 'completed', now);
  assert.equal(f.data.get(tables.locks)!.size, 0);
  await assert.rejects(acquireSaleLocks(f.client, tables, 'sale-1', ['buyer', 'partner'], intentHash, now), /déjà terminée/);
  await acquireSaleLocks(f.client, tables, 'sale-2', ['buyer'], intentHash, now);
  await releaseSaleLocks(f.client, tables, 'sale-1', ['buyer', 'partner'], intentHash, 'completed', now);
  assert.equal(f.data.get(tables.locks)!.get('buyer')!['operationId'], 'sale-2');
});

test('rejects invalid holders and detects inconsistent locks on replay', async () => {
  const f = fixture();
  await assert.rejects(acquireSaleLocks(f.client, tables, 'sale-1', ['buyer', 'buyer'], intentHash, now), /invalides/);
  await assert.rejects(acquireSaleLocks(f.client, tables, 'sale-1', ['buyer'], 'invalid', now), /invalides/);
  await acquireSaleLocks(f.client, tables, 'sale-1', ['buyer'], intentHash, now);
  f.data.get(tables.locks)!.delete('buyer');
  await assert.rejects(acquireSaleLocks(f.client, tables, 'sale-1', ['buyer'], intentHash, now), /incohérent/);
});
