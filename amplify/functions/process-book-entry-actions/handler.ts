import { createHash } from 'node:crypto';
import type { Schema } from '../../data/resource';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';

export const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const BOOK_ENTRY_TABLE = process.env['BOOK_ENTRY_TABLE_NAME'] || '';
const SALE_ITEM_TABLE = process.env['SALE_ITEM_TABLE_NAME'] || '';
const MEMBER_TABLE = process.env['MEMBER_TABLE_NAME'] || '';
const PLAYBOOK_TABLE = process.env['PLAYBOOK_TABLE_NAME'] || '';
const FULFILLMENT_EXECUTION_TABLE = process.env['FULFILLMENT_EXECUTION_TABLE_NAME'] || '';
const ASSISTANCE_REQUEST_TABLE = process.env['ASSISTANCE_REQUEST_TABLE_NAME'] || '';
const DEFAULT_PLAYBOOK_CREDITS = 12;

type Handler = Schema['processBookEntryActions']['functionHandler'];
type ActionResult = {
  executionId: string;
  actionType: 'CREATE_PLAYBOOK';
  status: 'completed' | 'failed' | 'skipped';
  resultId?: string;
  error?: string;
};

function requireEnvironment(): void {
  const missing = [
    ['BOOK_ENTRY_TABLE_NAME', BOOK_ENTRY_TABLE],
    ['SALE_ITEM_TABLE_NAME', SALE_ITEM_TABLE],
    ['MEMBER_TABLE_NAME', MEMBER_TABLE],
    ['PLAYBOOK_TABLE_NAME', PLAYBOOK_TABLE],
    ['FULFILLMENT_EXECUTION_TABLE_NAME', FULFILLMENT_EXECUTION_TABLE],
    ['ASSISTANCE_REQUEST_TABLE_NAME', ASSISTANCE_REQUEST_TABLE],
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
): Promise<void> {
  const now = new Date().toISOString();
  const assistanceRequestId = deterministicId('fulfillment-alert', executionId);
  try {
    await documentClient.send(new PutCommand({
      TableName: ASSISTANCE_REQUEST_TABLE,
      Item: {
        id: assistanceRequestId,
        nom: '[SYSTEME]',
        prenom: 'Pilote fulfillment',
        email: 'bridge.saintorens@free.fr',
        type: 'Support technique',
        texte: [
          '[Auto-rapport Pilote fulfillment v1] CREATE_PLAYBOOK a echoue',
          `Canal de paiement: ${paymentChannel}`,
          `BookEntry: ${bookEntryId}`,
          `Execution: ${executionId}`,
          `Article achete (index): ${purchasedItemIndex}`,
          `Erreur: ${error}`,
          '',
          'Le paiement peut etre confirme alors que le carnet de parties manque.',
          'Verifier le paiement et le BookEntry, puis relancer le fulfillment.',
          `Date: ${now}`,
        ].join('\n'),
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
): Promise<void> {
  const now = new Date().toISOString();
  await documentClient.send(new PutCommand({
    TableName: FULFILLMENT_EXECUTION_TABLE,
    Item: {
      id: executionId,
      bookEntryId,
      purchasedItemIndex,
      actionType: 'CREATE_PLAYBOOK',
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
  await reportFailureToAssistance(executionId, bookEntryId, purchasedItemIndex, error, paymentChannel);
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
      if (product['fulfillmentAction'] !== 'CREATE_PLAYBOOK') continue;

      const parameters = parseParameters(product['fulfillmentParameters']);
      const initialCredits = resolveInitialCredits(parameters);
      const beneficiaryMemberIds = Array.isArray(purchasedItem['beneficiaryMemberIds'])
        ? purchasedItem['beneficiaryMemberIds'].map(String)
        : [];
      const quantity = Number(purchasedItem['quantity']);
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
