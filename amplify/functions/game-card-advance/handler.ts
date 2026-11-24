import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { z } from 'zod';
import type { Schema } from '../../data/resource';
import { AdvanceTables, createAdvanceTransaction, getPreviousAdvances } from './transaction';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const s3 = new S3Client({});
const id = z.string().trim().min(1);
const inputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('previous'), gameId: id, memberIds: z.array(id).min(1).max(2) }),
  z.object({
    action: z.literal('create'),
    operationId: id, gameId: id, season: id, buyerId: id, coBuyerId: id.optional(),
    productId: id, priceCents: z.number().int().nonnegative().safe(),
    accepted: z.literal(true), confirmedPreviousAdvanceIds: z.array(id).optional(),
  }),
]);

function environment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Configuration avance absente : ${name}.`);
  return value;
}

function tables(): AdvanceTables {
  return {
    advances: environment('ADVANCES_TABLE'),
    advanceParticipants: environment('ADVANCE_PARTICIPANTS_TABLE'),
    games: environment('GAME_TABLE'),
    settlements: environment('GAME_SETTLEMENT_TABLE'),
    members: environment('MEMBER_TABLE'),
    products: environment('PRODUCT_TABLE'),
    entries: environment('BOOK_ENTRY_TABLE'),
    playBooks: environment('PLAY_BOOK_TABLE'),
  };
}

async function initializedSeason(): Promise<string> {
  const response = await s3.send(new GetObjectCommand({
    Bucket: environment('STORAGE_BUCKET_NAME'), Key: 'system/system_configuration.txt',
  }));
  if (!response.Body) throw new Error('Configuration comptable indisponible.');
  const config: unknown = JSON.parse(await response.Body.transformToString());
  if (!config || typeof config !== 'object' || !('accounting_initialized_season' in config)
    || typeof config.accounting_initialized_season !== 'string' || !config.accounting_initialized_season.trim()) {
    throw new Error('Saison comptable initialisée indisponible.');
  }
  return config.accounting_initialized_season;
}

export const handler: Schema['gameCardAdvance']['functionHandler'] = async event => {
  const raw: unknown = typeof event.arguments.input === 'string'
    ? JSON.parse(event.arguments.input) : event.arguments.input;
  const input = inputSchema.parse(raw);
  const advanceTables = tables();
  if (input.action === 'previous') {
    return JSON.stringify(await getPreviousAdvances(client, advanceTables, input.gameId, input.memberIds));
  }
  const { action, ...request } = input;
  return JSON.stringify(await createAdvanceTransaction(
    client, advanceTables, request, new Date(), await initializedSeason(),
  ));
};
