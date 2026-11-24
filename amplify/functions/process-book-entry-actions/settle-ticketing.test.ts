import assert from 'node:assert/strict';
import test from 'node:test';
import { GetCommand, PutCommand, ScanCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';

process.env['BOOK_ENTRY_TABLE_NAME'] = 'BookEntry';
process.env['SALE_ITEM_TABLE_NAME'] = 'SaleItem';
process.env['MEMBER_TABLE_NAME'] = 'Member';
process.env['PLAYBOOK_TABLE_NAME'] = 'PlayBook';
process.env['FULFILLMENT_EXECUTION_TABLE_NAME'] = 'FulfillmentExecution';
process.env['ASSISTANCE_REQUEST_TABLE_NAME'] = 'AssistanceRequest';
process.env['TICKETING_RESERVATION_TABLE_NAME'] = 'TicketingReservation';
process.env['SURVEY_RESPONSE_TABLE_NAME'] = 'SurveyResponse';

type Item = Record<string, any>;

const dinner = {
  id: 'product-noel', name: 'Repas de Noel adhérent', account: 'PAF', price: 15,
  fulfillmentAction: 'SETTLE_TICKETING_RESERVATION',
};
const members: Record<string, Item> = {
  'member-anne': { id: 'member-anne', firstname: 'Anne', lastname: 'DUPONT' },
  'member-jean': { id: 'member-jean', firstname: 'Jean', lastname: 'DUPONT' },
};

/** DynamoDB simulé en mémoire pour les tables utilisées par l'action. */
function fakeDynamo(
  products: Item[],
  bookEntries: Item[],
  reservations: Item[] = [],
  surveyResponses: Item[] = [],
) {
  const tables: Record<string, Map<string, Item>> = {
    BookEntry: new Map(bookEntries.map(item => [item.id, item])),
    SaleItem: new Map(products.map(item => [item.id, item])),
    Member: new Map(Object.values(members).map(item => [item.id, item])),
    FulfillmentExecution: new Map(),
    AssistanceRequest: new Map(),
    TicketingReservation: new Map(reservations.map(item => [item.id, { ...item }])),
    SurveyResponse: new Map(surveyResponses.map(item => [item.id, { ...item }])),
  };

  function conditionFailed(): never {
    const error = new Error('condition failed') as Error & { name: string };
    error.name = 'TransactionCanceledException';
    throw error;
  }

  async function send(command: unknown): Promise<any> {
    if (command instanceof GetCommand) {
      return { Item: tables[command.input.TableName!].get(String(command.input.Key?.['id'])) };
    }
    if (command instanceof ScanCommand) {
      const values = command.input.ExpressionAttributeValues!;
      const items = [...tables[command.input.TableName!].values()].filter(item => {
        if (command.input.TableName === 'SurveyResponse') {
          return item['memberId'] === values[':memberId']
            && item['paymentProductId'] === values[':productId']
            && item['paymentStatus'] === values[':payable']
            && item['requiresReconfirmation'] !== true;
        }
        return item['expectedProductId'] === values[':productId']
          && item['reservationKey'] === values[':reservationKey'];
      });
      return { Items: items };
    }
    if (command instanceof PutCommand) {
      const table = tables[command.input.TableName!];
      const item = command.input.Item as Item;
      if (command.input.TableName === 'AssistanceRequest' && table.has(item.id)) {
        const error = new Error('duplicate') as Error & { name: string };
        error.name = 'ConditionalCheckFailedException';
        throw error;
      }
      table.set(item.id, item);
      return {};
    }
    if (command instanceof TransactWriteCommand) {
      const writes = command.input.TransactItems!;
      for (const write of writes) {
        if (write.Update) {
          const current = tables[write.Update.TableName!].get(String(write.Update.Key!['id']));
          if (current?.['reservationStatus'] !== 'reserved') conditionFailed();
        }
        if (write.Put?.TableName === 'TicketingReservation' && tables.TicketingReservation.has(write.Put.Item!['id'])) {
          conditionFailed();
        }
      }
      for (const write of writes) {
        if (write.Put) tables[write.Put.TableName!].set(write.Put.Item!['id'], write.Put.Item as Item);
        if (write.Update) {
          const table = tables[write.Update.TableName!];
          const current = table.get(String(write.Update.Key!['id']))!;
          const names = write.Update.ExpressionAttributeNames!;
          const values = write.Update.ExpressionAttributeValues!;
          for (const [alias, name] of Object.entries(names)) {
            if (`:${alias.slice(1)}` in values) current[name] = values[`:${alias.slice(1)}`];
          }
          delete current['paymentId'];
        }
      }
      return {};
    }
    throw new Error(`Unexpected DynamoDB command: ${String(command)}`);
  }
  return { tables, send };
}

async function run(fake: ReturnType<typeof fakeDynamo>, bookEntryId: string): Promise<any> {
  const { documentClient, handler } = await import('./handler');
  const originalSend = documentClient.send.bind(documentClient);
  documentClient.send = fake.send as typeof documentClient.send;
  try {
    return await handler({ arguments: { bookEntryId } } as any, {} as any, (() => undefined) as any);
  } finally {
    documentClient.send = originalSend as typeof documentClient.send;
  }
}

const onlineSale = {
  id: 'sale-online', status: 'confirmed', season: '2026/2027', date: '2026-12-02',
  transaction_id: 'achat_adhérent_par_carte', stripeSessionId: 'cs_123', stripeTag: 'stripe:abc',
  purchasedItems: [{ productId: 'product-noel', beneficiaryMemberIds: ['member-anne'], quantity: 1 }],
};

test('an online payment settles the reservation coming from the survey, once', async () => {
  const fake = fakeDynamo([dinner], [onlineSale], [{
    id: 'reservation-anne', reservationKey: 'member:member-anne', expectedProductId: 'product-noel',
    reservationStatus: 'reserved', paymentId: 'stale', memberName: 'DUPONT Anne',
  }]);

  const first = await run(fake, 'sale-online');
  const replay = await run(fake, 'sale-online');

  assert.equal(first.completed, 1);
  assert.equal(replay.skipped, 1);
  assert.equal(fake.tables.TicketingReservation.size, 1);
  const reservation = fake.tables.TicketingReservation.get('reservation-anne')!;
  assert.equal(reservation['reservationStatus'], 'sold');
  assert.equal(reservation['paidChannel'], 'en_ligne');
  assert.equal(reservation['paymentMode'], 'card');
  assert.equal(reservation['bookEntryId'], 'sale-online');
  assert.equal(reservation['paidAmount'], 15);
  assert.equal(reservation['paidAccount'], 'PAF');
  assert.ok(reservation['accountedAt'], 'the sale is already accounted');
  assert.equal(reservation['paymentId'], undefined);
  assert.equal(fake.tables.AssistanceRequest.size, 0);
});

test('an online payment creates a missing reservation without alert when a payable survey response exists', async () => {
  const fake = fakeDynamo([dinner], [onlineSale], [], [{
    id: 'response-anne',
    memberId: 'member-anne',
    paymentProductId: 'product-noel',
    paymentStatus: 'payable',
  }]);

  const result = await run(fake, 'sale-online');

  assert.equal(result.completed, 1);
  const [reservation] = [...fake.tables.TicketingReservation.values()];
  assert.equal(reservation['reservationStatus'], 'sold');
  assert.equal(reservation['paidChannel'], 'en_ligne');
  assert.equal(fake.tables.AssistanceRequest.size, 0);
});

test('an online payment without a payable survey response creates an assistance request', async () => {
  const fake = fakeDynamo([dinner], [onlineSale]);

  const result = await run(fake, 'sale-online');

  assert.equal(result.completed, 1);
  assert.equal(fake.tables.AssistanceRequest.size, 1);
  const [report] = [...fake.tables.AssistanceRequest.values()];
  assert.match(String(report['texte']), /sans reponse payable au sondage/);
});

test('a cash sale at the counter that bypassed the survey check still records the payment and alerts the club', async () => {
  const counterSale = {
    id: 'sale-counter', status: 'confirmed', season: '2026/2027', date: '2026-12-05',
    transaction_id: 'achat_adhérent_en_espèces',
    purchasedItems: [{ productId: 'product-noel', beneficiaryMemberIds: ['member-jean'], quantity: 1 }],
  };
  const fake = fakeDynamo([dinner], [counterSale]);

  const result = await run(fake, 'sale-counter');

  assert.equal(result.completed, 1);
  const [reservation] = [...fake.tables.TicketingReservation.values()];
  assert.equal(reservation['memberName'], 'DUPONT Jean');
  assert.equal(reservation['reservationKey'], 'member:member-jean');
  assert.equal(reservation['expectedProductId'], 'product-noel');
  assert.equal(reservation['eventTitle'], 'Repas de Noel adhérent');
  assert.equal(reservation['reservationStatus'], 'sold');
  assert.equal(reservation['paidChannel'], 'caisse');
  assert.equal(reservation['paymentMode'], 'cash');
  assert.equal(reservation['date'], '2026-12-05');
  assert.equal(reservation['isMember'], true);
  const [report] = [...fake.tables.AssistanceRequest.values()];
  assert.match(String(report['texte']), /Repas paye sans reponse payable au sondage/);
  assert.match(String(report['texte']), /Adherent: DUPONT Jean/);
});

test('a second payment for an already paid reservation is reported as a double payment', async () => {
  const fake = fakeDynamo([dinner], [onlineSale], [{
    id: 'reservation-anne', reservationKey: 'member:member-anne', expectedProductId: 'product-noel',
    reservationStatus: 'sold', paidChannel: 'billetterie', memberName: 'DUPONT Anne',
  }]);

  const result = await run(fake, 'sale-online');

  assert.equal(result.failed, 1);
  assert.match(result.results[0].error, /double paiement/);
  assert.equal(fake.tables.TicketingReservation.get('reservation-anne')!['paidChannel'], 'billetterie');
  const [report] = [...fake.tables.AssistanceRequest.values()];
  assert.match(String(report['texte']), /SETTLE_TICKETING_RESERVATION a echoue/);
  assert.match(String(report['texte']), /double paiement possible/);
});

test('a couple product settles both reservations with half of the price each', async () => {
  const coupleDinner = { ...dinner, id: 'product-couple', price: 30, paired: true };
  const coupleSale = {
    id: 'sale-couple', status: 'confirmed', season: '2026/2027', date: '2026-12-05',
    transaction_id: 'achat_adhérent_par_chèque',
    purchasedItems: [{ productId: 'product-couple', beneficiaryMemberIds: ['member-anne', 'member-jean'], quantity: 1 }],
  };
  const fake = fakeDynamo([coupleDinner], [coupleSale]);

  const result = await run(fake, 'sale-couple');

  assert.equal(result.completed, 2);
  const reservations = [...fake.tables.TicketingReservation.values()];
  assert.deepEqual(reservations.map(item => item['memberName']).sort(), ['DUPONT Anne', 'DUPONT Jean']);
  assert.ok(reservations.every(item => item['paidAmount'] === 15 && item['paymentMode'] === 'cheque'));
});

test('products without this action leave reservations untouched', async () => {
  const fake = fakeDynamo([{ ...dinner, fulfillmentAction: undefined }], [onlineSale]);

  const result = await run(fake, 'sale-online');

  assert.equal(result.completed + result.failed + result.skipped, 0);
  assert.equal(fake.tables.TicketingReservation.size, 0);
});
