import assert from 'node:assert/strict';
import test from 'node:test';
import Stripe from 'stripe';
import { GetCommand, PutCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

process.env['STRIPE_SECRET_KEY'] = 'dummy';
process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_terminal_test';
process.env['STRIPE_TRANSACTION_TABLE_NAME'] = 'StripeTransaction';
process.env['BOOK_ENTRY_TABLE_NAME'] = 'BookEntry';
process.env['SALE_ITEM_TABLE_NAME'] = 'SaleItem';
process.env['MEMBER_TABLE_NAME'] = 'Member';
process.env['PLAYBOOK_TABLE_NAME'] = 'PlayBook';
process.env['FULFILLMENT_EXECUTION_TABLE_NAME'] = 'FulfillmentExecution';
process.env['ASSISTANCE_REQUEST_TABLE_NAME'] = 'AssistanceRequest';

test('terminal webhook confirms and fulfills its BookEntry exactly once', async () => {
  const webhookModule = await import('./handler');
  const fulfillmentModule = await import('../process-book-entry-actions/handler');
  const executions = new Map<string, Record<string, any>>();
  const playBooks = new Map<string, Record<string, any>>();
  const transactions = new Map<string, Record<string, any>>();
  const bookEntry: Record<string, any> = {
    id: 'book-entry-terminal',
    status: 'pending',
    stripeSessionId: 'pi_terminal',
    stripeTag: 'stripe:terminal',
    purchasedItems: [{ productId: 'card-product', beneficiaryMemberIds: ['member-1'], quantity: 1 }],
  };

  const originalWebhookSend = webhookModule.documentClient.send.bind(webhookModule.documentClient);
  const originalFulfillmentSend = fulfillmentModule.documentClient.send.bind(fulfillmentModule.documentClient);

  webhookModule.documentClient.send = (async (command: unknown) => {
    if (command instanceof GetCommand) {
      const table = command.input.TableName;
      if (table === 'BookEntry') return { Item: bookEntry };
      if (table === 'StripeTransaction') return { Item: transactions.get(String(command.input.Key?.['id'])) };
    }
    if (command instanceof UpdateCommand) {
      if (command.input.TableName === 'BookEntry') {
        bookEntry.status = 'confirmed';
        return {};
      }
      if (command.input.TableName === 'StripeTransaction') return {};
    }
    if (command instanceof PutCommand && command.input.TableName === 'StripeTransaction') {
      const item = command.input.Item as Record<string, any>;
      transactions.set(String(item['id']), item);
      return {};
    }
    throw new Error(`Unexpected webhook command: ${String(command)}`);
  }) as typeof webhookModule.documentClient.send;

  fulfillmentModule.documentClient.send = (async (command: unknown) => {
    if (command instanceof GetCommand) {
      const table = command.input.TableName;
      const id = String(command.input.Key?.['id']);
      if (table === 'BookEntry') return { Item: bookEntry };
      if (table === 'SaleItem') return { Item: { id, fulfillmentAction: 'CREATE_PLAYBOOK', fulfillmentParameters: JSON.stringify({ initialCredits: 12 }) } };
      if (table === 'Member') return { Item: { id, license_number: '00000001' } };
      if (table === 'FulfillmentExecution') return { Item: executions.get(id) };
    }
    if (command instanceof TransactWriteCommand) {
      const playBook = command.input.TransactItems?.[0]?.Put?.Item as Record<string, any>;
      const execution = command.input.TransactItems?.[1]?.Put?.Item as Record<string, any>;
      playBooks.set(String(playBook['id']), playBook);
      executions.set(String(execution['id']), execution);
      return {};
    }
    throw new Error(`Unexpected fulfillment command: ${String(command)}`);
  }) as typeof fulfillmentModule.documentClient.send;

  const payload = JSON.stringify({
    id: 'evt_terminal',
    object: 'event',
    api_version: '2024-04-10',
    created: 1,
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: 'pi_terminal',
        object: 'payment_intent',
        amount: 3000,
        currency: 'eur',
        metadata: {
          source: 'terminal',
          bookEntryId: bookEntry.id,
          stripeTag: 'stripe:terminal',
        },
      },
    },
  });
  const stripe = new Stripe('dummy', { apiVersion: '2024-04-10' as any });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_terminal_test' });
  const event = { body: payload, headers: { 'stripe-signature': signature } } as any;

  try {
    const first = await webhookModule.handler(event);
    const second = await webhookModule.handler(event);

    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    assert.equal(bookEntry.status, 'confirmed');
    assert.equal(playBooks.size, 1);
    assert.equal(executions.size, 1);
    assert.equal(transactions.get('pi_terminal')?.['bookEntryId'], bookEntry.id);
  } finally {
    webhookModule.documentClient.send = originalWebhookSend as typeof webhookModule.documentClient.send;
    fulfillmentModule.documentClient.send = originalFulfillmentSend as typeof fulfillmentModule.documentClient.send;
  }
});