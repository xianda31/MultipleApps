import assert from 'node:assert/strict';
import test from 'node:test';
import { GetCommand, PutCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';

process.env['BOOK_ENTRY_TABLE_NAME'] = 'BookEntry';
process.env['SALE_ITEM_TABLE_NAME'] = 'SaleItem';
process.env['MEMBER_TABLE_NAME'] = 'Member';
process.env['PLAYBOOK_TABLE_NAME'] = 'PlayBook';
process.env['FULFILLMENT_EXECUTION_TABLE_NAME'] = 'FulfillmentExecution';
process.env['ASSISTANCE_REQUEST_TABLE_NAME'] = 'AssistanceRequest';

test('replaying a confirmed BookEntry creates one PlayBook', async () => {
  const { documentClient, handler } = await import('./handler');
  const executions = new Map<string, Record<string, unknown>>();
  const playBooks = new Map<string, Record<string, unknown>>();
  const bookEntry = {
    id: 'book-entry-1',
    status: 'confirmed',
    purchasedItems: [{
      productId: 'card-product',
      beneficiaryMemberIds: ['member-1'],
      quantity: 1,
    }],
  };
  const product = {
    id: 'card-product',
    fulfillmentAction: 'CREATE_PLAYBOOK',
    fulfillmentParameters: JSON.stringify({ initialCredits: 12 }),
  };
  const member = { id: 'member-1', license_number: '00000001' };

  const originalSend = documentClient.send.bind(documentClient);
  documentClient.send = (async (command: unknown) => {
    if (command instanceof GetCommand) {
      const input = command.input;
      const id = String(input.Key?.['id']);
      if (input.TableName === 'BookEntry') return { Item: bookEntry };
      if (input.TableName === 'SaleItem') return { Item: product };
      if (input.TableName === 'Member') return { Item: member };
      if (input.TableName === 'FulfillmentExecution') return { Item: executions.get(id) };
    }

    if (command instanceof TransactWriteCommand) {
      const playBook = command.input.TransactItems?.[0]?.Put?.Item as Record<string, unknown>;
      const execution = command.input.TransactItems?.[1]?.Put?.Item as Record<string, unknown>;
      playBooks.set(String(playBook['id']), playBook);
      executions.set(String(execution['id']), execution);
      return {};
    }

    if (command instanceof PutCommand) {
      const item = command.input.Item as Record<string, unknown>;
      if (command.input.TableName === 'AssistanceRequest') return {};
      executions.set(String(item['id']), item);
      return {};
    }

    throw new Error(`Unexpected DynamoDB command: ${String(command)}`);
  }) as typeof documentClient.send;

  try {
    const event = { arguments: { bookEntryId: 'book-entry-1' } } as any;
    const context = {} as any;
    const callback = (() => undefined) as any;
    const first = await handler(event, context, callback) as any;
    const second = await handler(event, context, callback) as any;

    assert.equal(first.completed, 1);
    assert.equal(first.skipped, 0);
    assert.equal(second.completed, 0);
    assert.equal(second.skipped, 1);
    assert.equal(playBooks.size, 1);
    assert.equal(executions.size, 1);
  } finally {
    documentClient.send = originalSend as typeof documentClient.send;
  }
});

test('replaying a failed CREATE_PLAYBOOK creates one assistance request', async () => {
  const { documentClient, handler } = await import('./handler');
  const executions = new Map<string, Record<string, unknown>>();
  const assistanceRequests = new Map<string, Record<string, unknown>>();
  const bookEntry = {
    id: 'book-entry-failed',
    status: 'confirmed',
    stripeSessionId: 'cs_failed',
    purchasedItems: [{
      productId: 'card-product',
      beneficiaryMemberIds: ['member-without-license'],
      quantity: 1,
    }],
  };

  const originalSend = documentClient.send.bind(documentClient);
  documentClient.send = (async (command: unknown) => {
    if (command instanceof GetCommand) {
      const input = command.input;
      const id = String(input.Key?.['id']);
      if (input.TableName === 'BookEntry') return { Item: bookEntry };
      if (input.TableName === 'SaleItem') return { Item: {
        id,
        fulfillmentAction: 'CREATE_PLAYBOOK',
        fulfillmentParameters: JSON.stringify({ initialCredits: 12 }),
      } };
      if (input.TableName === 'Member') return { Item: { id } };
      if (input.TableName === 'FulfillmentExecution') return { Item: executions.get(id) };
    }

    if (command instanceof PutCommand) {
      const item = command.input.Item as Record<string, unknown>;
      const id = String(item['id']);
      if (command.input.TableName === 'FulfillmentExecution') {
        executions.set(id, item);
        return {};
      }
      if (command.input.TableName === 'AssistanceRequest') {
        if (assistanceRequests.has(id)) {
          const error = new Error('duplicate') as Error & { name: string };
          error.name = 'ConditionalCheckFailedException';
          throw error;
        }
        assistanceRequests.set(id, item);
        return {};
      }
    }

    throw new Error(`Unexpected DynamoDB command: ${String(command)}`);
  }) as typeof documentClient.send;

  try {
    const event = { arguments: { bookEntryId: bookEntry.id } } as any;
    const first = await handler(event, {} as any, (() => undefined) as any) as any;
    const second = await handler(event, {} as any, (() => undefined) as any) as any;

    assert.equal(first.failed, 1);
    assert.equal(second.failed, 1);
    assert.equal(executions.size, 1);
    assert.equal(assistanceRequests.size, 1);
    assert.match(String([...assistanceRequests.values()][0]?.['texte']), /Canal de paiement: Stripe/);
  } finally {
    documentClient.send = originalSend as typeof documentClient.send;
  }
});