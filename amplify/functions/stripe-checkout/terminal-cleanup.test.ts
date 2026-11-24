import assert from 'node:assert/strict';
import test from 'node:test';
import { DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import type Stripe from 'stripe';

process.env['STRIPE_SECRET_KEY'] = 'dummy';
process.env['BOOK_ENTRY_TABLE_NAME'] = 'BookEntry';

const event = (body: object) => ({
  rawPath: '/api/stripe/terminal-payment-intent',
  body: JSON.stringify(body),
  requestContext: { authorizer: { claims: { 'cognito:groups': ['Editeur'] } } },
});

test('only removes a pending entry linked to a confirmed canceled intent', async () => {
  const { handler, docClient, stripe } = await import('./handler');
  const originalRetrieve = stripe.paymentIntents.retrieve;
  const originalSend = docClient.send;
  let status: Stripe.PaymentIntent.Status = 'succeeded';
  let metadataEntry = 'entry';
  let entry: Record<string, unknown> | undefined = { id: 'entry', status: 'pending', stripeSessionId: 'pi_1' };
  let deletes = 0;
  stripe.paymentIntents.retrieve = async () =>
    Object.assign({} as Stripe.Response<Stripe.PaymentIntent>, { status, metadata: { bookEntryId: metadataEntry } });
  docClient.send = (async (command: unknown) => {
    if (command instanceof GetCommand) return { Item: entry };
    if (command instanceof DeleteCommand) {
      deletes++;
      assert.equal(command.input.ConditionExpression, '#status = :pending AND stripeSessionId = :intent');
      assert.equal(command.input.ExpressionAttributeValues?.[':intent'], 'pi_1');
      entry = undefined;
      return {};
    }
    throw new Error('Unexpected DynamoDB command');
  }) as typeof docClient.send;
  const request = event({ action: 'cleanup', bookEntryId: 'entry', paymentIntentId: 'pi_1' });
  try {
    assert.equal((await handler(request)).statusCode, 409);
    status = 'canceled';
    metadataEntry = 'another-entry';
    assert.equal((await handler(request)).statusCode, 409);
    assert.equal(deletes, 0);
    metadataEntry = 'entry';
    assert.equal((await handler(request)).statusCode, 200);
    assert.equal((await handler(request)).statusCode, 200);
    assert.equal(deletes, 1);
  } finally {
    stripe.paymentIntents.retrieve = originalRetrieve;
    docClient.send = originalSend;
  }
});

test('reports an already canceled PaymentIntent as canceled on retry', async () => {
  const { handler, stripe } = await import('./handler');
  const originalRetrieve = stripe.paymentIntents.retrieve;
  const originalCancel = stripe.paymentIntents.cancel;
  stripe.paymentIntents.cancel = (async () => {
    throw Object.assign(new Error('already canceled'), { code: 'payment_intent_unexpected_state' });
  }) as typeof originalCancel;
  stripe.paymentIntents.retrieve = async () => ({ status: 'canceled' } as Stripe.Response<Stripe.PaymentIntent>);
  try {
    const result = await handler(event({ action: 'cancel', paymentIntentId: 'pi_1', verifyExisting: true }));
    assert.equal(result.statusCode, 200);
    assert.equal(JSON.parse(result.body).status, 'canceled');
  } finally {
    stripe.paymentIntents.cancel = originalCancel;
    stripe.paymentIntents.retrieve = originalRetrieve;
  }
});

test('preserves the legacy cancellation response without the shared option', async () => {
  const { handler, stripe } = await import('./handler');
  const originalRetrieve = stripe.paymentIntents.retrieve;
  const originalCancel = stripe.paymentIntents.cancel;
  let retrieved = false;
  stripe.paymentIntents.cancel = (async () => {
    throw Object.assign(new Error('already canceled'), { code: 'payment_intent_unexpected_state' });
  }) as typeof originalCancel;
  stripe.paymentIntents.retrieve = async () => {
    retrieved = true;
    return { status: 'canceled' } as Stripe.Response<Stripe.PaymentIntent>;
  };
  try {
    const result = await handler(event({ action: 'cancel', paymentIntentId: 'pi_1' }));
    assert.equal(JSON.parse(result.body).status, 'already_processed');
    assert.equal(retrieved, false);
  } finally {
    stripe.paymentIntents.cancel = originalCancel;
    stripe.paymentIntents.retrieve = originalRetrieve;
  }
});
