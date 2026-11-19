import { createHash } from 'node:crypto';
import type { Schema } from '../../data/resource';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { notifyPlayBookUpdate } from './appsync-playbook-notifier';

export const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const BOOK_ENTRY_TABLE = process.env['BOOK_ENTRY_TABLE_NAME'] || '';
const SALE_ITEM_TABLE = process.env['SALE_ITEM_TABLE_NAME'] || '';
const MEMBER_TABLE = process.env['MEMBER_TABLE_NAME'] || '';
const PLAYBOOK_TABLE = process.env['PLAYBOOK_TABLE_NAME'] || '';
const FULFILLMENT_EXECUTION_TABLE = process.env['FULFILLMENT_EXECUTION_TABLE_NAME'] || '';
const ASSISTANCE_REQUEST_TABLE = process.env['ASSISTANCE_REQUEST_TABLE_NAME'] || '';
const TICKETING_RESERVATION_TABLE = process.env['TICKETING_RESERVATION_TABLE_NAME'] || '';
const DEFAULT_PLAYBOOK_CREDITS = 12;

export const playBookNotifier = {
  notify: notifyPlayBookUpdate,
};

type Handler = Schema['processBookEntryActions']['functionHandler'];
type ActionType = 'CREATE_PLAYBOOK' | 'SETTLE_TICKETING_RESERVATION';
type ActionResult = {
  executionId: string;
  actionType: ActionType;
  status: 'completed' | 'failed' | 'skipped';
  resultId?: string;
  error?: string;
};

/** Conséquence d'un échec, rappelée dans le rapport d'assistance. */
const FAILURE_CONSEQUENCE: Record<ActionType, string> = {
  CREATE_PLAYBOOK: 'Le paiement peut etre confirme alors que le carnet de parties manque.',
  SETTLE_TICKETING_RESERVATION:
    'Le paiement est confirme mais la reservation billetterie n est pas marquee payee (ou l etait deja : double paiement possible).',
};

function requireEnvironment(): void {
  const missing = [
    ['BOOK_ENTRY_TABLE_NAME', BOOK_ENTRY_TABLE],
    ['SALE_ITEM_TABLE_NAME', SALE_ITEM_TABLE],
    ['MEMBER_TABLE_NAME', MEMBER_TABLE],
    ['PLAYBOOK_TABLE_NAME', PLAYBOOK_TABLE],
    ['FULFILLMENT_EXECUTION_TABLE_NAME', FULFILLMENT_EXECUTION_TABLE],
    ['ASSISTANCE_REQUEST_TABLE_NAME', ASSISTANCE_REQUEST_TABLE],
    ['TICKETING_RESERVATION_TABLE_NAME', TICKETING_RESERVATION_TABLE],
  ].filter(([, value]) => !value).map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
}

function parseParameters(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      throw new Error('Invalid fulfillmentParameters JSON');
    }
  }
  return value as Record<string, unknown>;
}

function resolveInitialCredits(parameters: Record<string, unknown>): number {
  const configured = parameters['initialCredits'];
  if (configured == null) return DEFAULT_PLAYBOOK_CREDITS;
  if (!Number.isInteger(configured) || Number(configured) <= 0) {
    throw new Error('initialCredits must be a positive integer');
  }
  return Number(configured);
}

function deterministicId(prefix: string, source: string): string {
  return `${prefix}-${createHash('sha256').update(source).digest('hex').slice(0, 32)}`;
}

async function reportFailureToAssistance(
  executionId: string,
  bookEntryId: string,
  purchasedItemIndex: number,
  error: string,
  paymentChannel: string,
  actionType: ActionType = 'CREATE_PLAYBOOK',
): Promise<void> {
  const now = new Date().toISOString();
  await createAssistanceRequest(deterministicId('fulfillment-alert', executionId), executionId, [
    `[Auto-rapport Pilote fulfillment v1] ${actionType} a echoue`,
    `Canal de paiement: ${paymentChannel}`,
    `BookEntry: ${bookEntryId}`,
    `Execution: ${executionId}`,
    `Article achete (index): ${purchasedItemIndex}`,
    `Erreur: ${error}`,
    '',
    FAILURE_CONSEQUENCE[actionType],
    'Verifier le paiement et le BookEntry, puis relancer le fulfillment.',
    `Date: ${now}`,
  ]);
}

async function createAssistanceRequest(assistanceRequestId: string, executionId: string, lines: string[]): Promise<void> {
  const now = new Date().toISOString();
  try {
    await documentClient.send(new PutCommand({
      TableName: ASSISTANCE_REQUEST_TABLE,
      Item: {
        id: assistanceRequestId,
        nom: '[SYSTEME]',
        prenom: 'Pilote fulfillment',
        email: 'bridge.saintorens@free.fr',
        type: 'Support technique',
        texte: lines.join('\n'),
        status: 'nouveau',
        createdAt: now,
        updatedAt: now,
        __typename: 'AssistanceRequest',
      },
      ConditionExpression: 'attribute_not_exists(id)',
    }));
  } catch (assistanceError: any) {
    if (assistanceError?.name !== 'ConditionalCheckFailedException') {
      console.error('[fulfillment] Unable to create assistance request', {
        assistanceRequestId,
        executionId,
        error: assistanceError?.message || String(assistanceError),
      });
    }
  }
}

async function recordFailure(
  executionId: string,
  bookEntryId: string,
  purchasedItemIndex: number,
  error: string,
  paymentChannel: string,
  actionType: ActionType = 'CREATE_PLAYBOOK',
): Promise<void> {
  const now = new Date().toISOString();
  await documentClient.send(new PutCommand({
    TableName: FULFILLMENT_EXECUTION_TABLE,
    Item: {
      id: executionId,
      bookEntryId,
      purchasedItemIndex,
      actionType,
      status: 'failed',
      error,
      createdAt: now,
      updatedAt: now,
      __typename: 'FulfillmentExecution',
    },
    ConditionExpression: 'attribute_not_exists(id) OR #status <> :completed',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':completed': 'completed' },
  }));
  await reportFailureToAssistance(executionId, bookEntryId, purchasedItemIndex, error, paymentChannel, actionType);
}

async function notifyPlayBookUpdateBestEffort(playBookId: string): Promise<void> {
  if (!playBookId) {
    console.error('[fulfillment] Completed execution has no PlayBook resultId');
    return;
  }
  try {
    await playBookNotifier.notify(playBookId);
  } catch (error) {
    console.error('[fulfillment] Unable to publish PlayBook update to AppSync', {
      playBookId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function createPlayBook(
  bookEntryId: string,
  purchasedItemIndex: number,
  unitIndex: number,
  beneficiaryMemberIds: string[],
  initialCredits: number,
  paymentChannel: string,
): Promise<ActionResult> {
  const executionId = `${bookEntryId}:${purchasedItemIndex}:${unitIndex}:CREATE_PLAYBOOK`;
  const existingExecution = await documentClient.send(new GetCommand({
    TableName: FULFILLMENT_EXECUTION_TABLE,
    Key: { id: executionId },
  }));
  if (existingExecution.Item?.['status'] === 'completed') {
    await notifyPlayBookUpdateBestEffort(String(existingExecution.Item['resultId'] || ''));
    return {
      executionId,
      actionType: 'CREATE_PLAYBOOK',
      status: 'skipped',
      resultId: existingExecution.Item['resultId'],
    };
  }

  try {
    if (beneficiaryMemberIds.length === 0) {
      throw new Error('CREATE_PLAYBOOK requires at least one beneficiary');
    }

    const licenses: string[] = [];
    for (const memberId of beneficiaryMemberIds) {
      const memberResult = await documentClient.send(new GetCommand({
        TableName: MEMBER_TABLE,
        Key: { id: memberId },
      }));
      if (!memberResult.Item) {
        throw new Error(`Member ${memberId} not found`);
      }

      const license = String(memberResult.Item['license_number'] || '').trim();
      if (!license) {
        throw new Error(`Member ${memberId} has no license and cannot receive a PlayBook`);
      }
      licenses.push(license);
    }

    const uniqueLicenses = [...new Set(licenses)];
    const playBookId = deterministicId('fulfillment', executionId);
    const now = new Date().toISOString();

    await documentClient.send(new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: PLAYBOOK_TABLE,
            Item: {
              id: playBookId,
              initial_qty: initialCredits,
              licenses: uniqueLicenses,
              stamps: [],
              manual_creation: false,
              bookEntry_id: bookEntryId,
              createdAt: now,
              updatedAt: now,
              __typename: 'PlayBook',
            },
            ConditionExpression: 'attribute_not_exists(id)',
          },
        },
        {
          Put: {
            TableName: FULFILLMENT_EXECUTION_TABLE,
            Item: {
              id: executionId,
              bookEntryId,
              purchasedItemIndex,
              actionType: 'CREATE_PLAYBOOK',
              status: 'completed',
              resultId: playBookId,
              createdAt: now,
              updatedAt: now,
              __typename: 'FulfillmentExecution',
            },
            ConditionExpression: 'attribute_not_exists(id) OR #status = :failed',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':failed': 'failed' },
          },
        },
      ],
    }));
    await notifyPlayBookUpdateBestEffort(playBookId);

    return {
      executionId,
      actionType: 'CREATE_PLAYBOOK',
      status: 'completed',
      resultId: playBookId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const completedExecution = await documentClient.send(new GetCommand({
      TableName: FULFILLMENT_EXECUTION_TABLE,
      Key: { id: executionId },
      ConsistentRead: true,
    }));
    if (completedExecution.Item?.['status'] === 'completed') {
      await notifyPlayBookUpdateBestEffort(String(completedExecution.Item['resultId'] || ''));
      return {
        executionId,
        actionType: 'CREATE_PLAYBOOK',
        status: 'skipped',
        resultId: completedExecution.Item['resultId'],
      };
    }

    try {
      await recordFailure(executionId, bookEntryId, purchasedItemIndex, message, paymentChannel);
    } catch (recordError: any) {
      if (recordError?.name !== 'ConditionalCheckFailedException') throw recordError;
      return { executionId, actionType: 'CREATE_PLAYBOOK', status: 'skipped' };
    }
    return { executionId, actionType: 'CREATE_PLAYBOOK', status: 'failed', error: message };
  }
}

type BookEntryRecord = Record<string, any>;
type ReservationRecord = Record<string, any>;

/** Canal et mode de paiement d'une vente en caisse ou en ligne. */
export function describeSale(bookEntry: BookEntryRecord): { channel: 'caisse' | 'en_ligne'; paymentMode: string } {
  const transactionId = String(bookEntry['transaction_id'] || '');
  const paymentMode = /espèces/.test(transactionId) ? 'cash'
    : /chèque/.test(transactionId) ? 'cheque'
      : /carte/.test(transactionId) || bookEntry['stripeTag'] ? 'card'
        : 'other';
  return { channel: bookEntry['stripeSessionId'] ? 'en_ligne' : 'caisse', paymentMode };
}

async function findReservations(productId: string, reservationKey: string): Promise<ReservationRecord[]> {
  const reservations: ReservationRecord[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const page = await documentClient.send(new ScanCommand({
      TableName: TICKETING_RESERVATION_TABLE,
      FilterExpression: 'expectedProductId = :productId AND reservationKey = :reservationKey',
      ExpressionAttributeValues: { ':productId': productId, ':reservationKey': reservationKey },
      ExclusiveStartKey: exclusiveStartKey,
    }));
    reservations.push(...(page.Items ?? []));
    exclusiveStartKey = page.LastEvaluatedKey;
  } while (exclusiveStartKey);
  return reservations.filter((reservation) => reservation['reservationStatus'] !== 'cancelled');
}

/**
 * Règle la réservation billetterie d'un adhérent après une vente en caisse ou en ligne :
 * la réservation issue du sondage passe à « payée », ou est créée payée si l'adhérent n'avait pas répondu.
 * La vente étant déjà comptabilisée, la réservation est marquée comptabilisée.
 */
async function settleTicketingReservation(
  bookEntry: BookEntryRecord,
  purchasedItemIndex: number,
  memberId: string,
  product: Record<string, any>,
  amount: number,
  paymentChannel: string,
): Promise<ActionResult> {
  const actionType = 'SETTLE_TICKETING_RESERVATION';
  const bookEntryId = String(bookEntry['id']);
  const executionId = `${bookEntryId}:${purchasedItemIndex}:${memberId}:${actionType}`;
  const existingExecution = await documentClient.send(new GetCommand({
    TableName: FULFILLMENT_EXECUTION_TABLE,
    Key: { id: executionId },
  }));
  if (existingExecution.Item?.['status'] === 'completed') {
    return { executionId, actionType, status: 'skipped', resultId: existingExecution.Item['resultId'] };
  }

  try {
    const memberResult = await documentClient.send(new GetCommand({ TableName: MEMBER_TABLE, Key: { id: memberId } }));
    const member = memberResult.Item;
    if (!member) throw new Error(`Member ${memberId} not found`);
    const memberName = `${member['lastname'] ?? ''} ${member['firstname'] ?? ''}`.trim();

    const productId = String(product['id']);
    const reservationKey = `member:${memberId}`;
    const [existing] = await findReservations(productId, reservationKey);
    if (existing?.['reservationStatus'] === 'sold') {
      throw new Error(`${memberName} avait déjà réglé ce repas (${existing['paidChannel'] || 'billetterie'}) : double paiement`);
    }

    const { channel, paymentMode } = describeSale(bookEntry);
    const now = new Date().toISOString();
    const paid = {
      reservationStatus: 'sold',
      paidChannel: channel,
      bookEntryId,
      paidAmount: amount,
      paidAccount: String(product['account'] || ''),
      paidProductId: productId,
      paymentMode,
      paidAt: now,
      accountedAt: now,
      updatedAt: now,
    };
    const reservationId = existing ? String(existing['id']) : deterministicId('ticketing', executionId);
    const reservationWrite = existing
      ? {
        Update: {
          TableName: TICKETING_RESERVATION_TABLE,
          Key: { id: reservationId },
          UpdateExpression: `SET ${Object.keys(paid).map((key) => `#${key} = :${key}`).join(', ')} REMOVE #paymentId`,
          ConditionExpression: '#reservationStatus = :reserved',
          ExpressionAttributeNames: {
            ...Object.fromEntries(Object.keys(paid).map((key) => [`#${key}`, key])),
            '#paymentId': 'paymentId',
          },
          ExpressionAttributeValues: {
            ...Object.fromEntries(Object.entries(paid).map(([key, value]) => [`:${key}`, value])),
            ':reserved': 'reserved',
          },
        },
      }
      : {
        Put: {
          TableName: TICKETING_RESERVATION_TABLE,
          Item: {
            id: reservationId,
            season: String(bookEntry['season'] || ''),
            date: String(bookEntry['date'] || now.slice(0, 10)),
            eventTitle: String(product['name'] || productId),
            reservationKey,
            memberId,
            memberName,
            isMember: true,
            expectedProductId: productId,
            source: channel,
            ...paid,
            createdAt: now,
            __typename: 'TicketingReservation',
          },
          ConditionExpression: 'attribute_not_exists(id)',
        },
      };

    await documentClient.send(new TransactWriteCommand({
      TransactItems: [
        reservationWrite,
        {
          Put: {
            TableName: FULFILLMENT_EXECUTION_TABLE,
            Item: {
              id: executionId,
              bookEntryId,
              purchasedItemIndex,
              actionType,
              status: 'completed',
              resultId: reservationId,
              createdAt: now,
              updatedAt: now,
              __typename: 'FulfillmentExecution',
            },
            ConditionExpression: 'attribute_not_exists(id) OR #status = :failed',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':failed': 'failed' },
          },
        },
      ],
    }));
    if (!existing) {
      // Normalement impossible : la boutique refuse la vente sans réponse au sondage. Choix de menu inconnu.
      await createAssistanceRequest(deterministicId('ticketing-without-survey', executionId), executionId, [
        '[Auto-rapport Pilote fulfillment v1] Repas paye sans reponse au sondage',
        `Adherent: ${memberName}`,
        `Produit: ${String(product['name'] || productId)}`,
        `Canal de paiement: ${channel}`,
        `BookEntry: ${bookEntryId}`,
        '',
        'La reservation a ete creee et marquee payee, mais son choix de menu est inconnu.',
        'Recueillir son choix et le saisir dans les resultats du sondage.',
        `Date: ${now}`,
      ]);
    }
    return { executionId, actionType, status: 'completed', resultId: reservationId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const completedExecution = await documentClient.send(new GetCommand({
      TableName: FULFILLMENT_EXECUTION_TABLE,
      Key: { id: executionId },
      ConsistentRead: true,
    }));
    if (completedExecution.Item?.['status'] === 'completed') {
      return { executionId, actionType, status: 'skipped', resultId: completedExecution.Item['resultId'] };
    }
    try {
      await recordFailure(executionId, bookEntryId, purchasedItemIndex, message, paymentChannel, actionType);
    } catch (recordError: any) {
      if (recordError?.name !== 'ConditionalCheckFailedException') throw recordError;
      return { executionId, actionType, status: 'skipped' };
    }
    return { executionId, actionType, status: 'failed', error: message };
  }
}

export const handler: Handler = async (event) => {
  requireEnvironment();
  const bookEntryId = event.arguments.bookEntryId;
  const bookEntryResult = await documentClient.send(new GetCommand({
    TableName: BOOK_ENTRY_TABLE,
    Key: { id: bookEntryId },
  }));
  const bookEntry = bookEntryResult.Item;
  if (!bookEntry) throw new Error(`BookEntry ${bookEntryId} not found`);
  if (bookEntry['status'] !== 'confirmed') {
    throw new Error(`BookEntry ${bookEntryId} is not confirmed`);
  }

  const purchasedItems = Array.isArray(bookEntry['purchasedItems']) ? bookEntry['purchasedItems'] : [];
  const results: ActionResult[] = [];
  const paymentChannel = bookEntry['stripeSessionId'] || bookEntry['stripeTag']
    ? 'Stripe'
    : 'autre moyen de paiement';

  let currentItemIndex = -1;
  try {
    for (let itemIndex = 0; itemIndex < purchasedItems.length; itemIndex += 1) {
      currentItemIndex = itemIndex;
      const purchasedItem = purchasedItems[itemIndex] as Record<string, unknown>;
      const productId = String(purchasedItem['productId'] || '');
      const productResult = await documentClient.send(new GetCommand({
        TableName: SALE_ITEM_TABLE,
        Key: { id: productId },
      }));
      const product = productResult.Item;
      if (!product) throw new Error(`SaleItem ${productId} not found`);
      const beneficiaryMemberIds = Array.isArray(purchasedItem['beneficiaryMemberIds'])
        ? purchasedItem['beneficiaryMemberIds'].map(String)
        : [];
      const quantity = Number(purchasedItem['quantity']);

      if (product['fulfillmentAction'] === 'SETTLE_TICKETING_RESERVATION') {
        if (quantity !== 1) throw new Error(`Invalid quantity for purchased item ${itemIndex}: one ticket per beneficiary expected`);
        if (beneficiaryMemberIds.length === 0) throw new Error(`Purchased item ${itemIndex} has no beneficiary`);
        // Un produit « couple » est vendu au prix total pour ses deux bénéficiaires.
        const price = Number(product['price'] || 0);
        const amount = product['paired'] ? price / beneficiaryMemberIds.length : price;
        for (const memberId of new Set(beneficiaryMemberIds)) {
          results.push(await settleTicketingReservation(bookEntry, itemIndex, memberId, product, amount, paymentChannel));
        }
        continue;
      }
      if (product['fulfillmentAction'] !== 'CREATE_PLAYBOOK') continue;

      const parameters = parseParameters(product['fulfillmentParameters']);
      const initialCredits = resolveInitialCredits(parameters);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error(`Invalid quantity for purchased item ${itemIndex}`);
      }

      for (let unitIndex = 0; unitIndex < quantity; unitIndex += 1) {
        results.push(await createPlayBook(
          bookEntryId,
          itemIndex,
          unitIndex,
          beneficiaryMemberIds,
          initialCredits,
          paymentChannel,
        ));
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await reportFailureToAssistance(
      `${bookEntryId}:PROCESS_BOOK_ENTRY_ACTIONS`,
      bookEntryId,
      currentItemIndex,
      message,
      paymentChannel,
    );
    throw error;
  }

  return {
    bookEntryId,
    completed: results.filter((result) => result.status === 'completed').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
    failed: results.filter((result) => result.status === 'failed').length,
    results,
  };
};
