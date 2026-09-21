import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

const DEFAULT_FEATURED_DURATION_DAYS = 30;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
export const s3Client = new S3Client({});

type FeaturedSnippet = {
  id: string;
  featured?: boolean;
  publishedAt?: string;
};

export function featuredDurationDays(settings: unknown): number {
  const configured = Number((settings as any)?.homepage?.featured_duration_days);
  return Number.isInteger(configured) && configured >= 1 && configured <= 365
    ? configured
    : DEFAULT_FEATURED_DURATION_DAYS;
}

export function isFeaturedExpired(snippet: FeaturedSnippet, durationDays: number, now = new Date()): boolean {
  if (!snippet.featured || !snippet.publishedAt) return false;
  const publishedAt = Date.parse(`${snippet.publishedAt.substring(0, 10)}T00:00:00Z`);
  return Number.isFinite(publishedAt) && now.getTime() >= publishedAt + durationDays * MILLISECONDS_PER_DAY;
}

async function loadDurationDays(bucketName: string): Promise<number> {
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: bucketName,
    Key: 'system/ui_settings.txt',
  }));
  const settings = JSON.parse(await response.Body!.transformToString());
  return featuredDurationDays(settings);
}

async function listFeaturedSnippets(tableName: string): Promise<FeaturedSnippet[]> {
  const snippets: FeaturedSnippet[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const response = await documentClient.send(new ScanCommand({
      TableName: tableName,
      FilterExpression: '#featured = :true',
      ProjectionExpression: 'id, #featured, publishedAt',
      ExpressionAttributeNames: { '#featured': 'featured' },
      ExpressionAttributeValues: { ':true': true },
      ExclusiveStartKey: exclusiveStartKey,
    }));
    snippets.push(...(response.Items as FeaturedSnippet[] ?? []));
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return snippets;
}

export const handler = async (): Promise<{ checked: number, expired: number, durationDays: number }> => {
  const tableName = process.env['SNIPPET_TABLE_NAME'];
  const bucketName = process.env['STORAGE_BUCKET_NAME'];
  if (!tableName || !bucketName) throw new Error('Missing SNIPPET_TABLE_NAME or STORAGE_BUCKET_NAME');

  const durationDays = await loadDurationDays(bucketName);
  const snippets = await listFeaturedSnippets(tableName);
  const expired = snippets.filter(snippet => isFeaturedExpired(snippet, durationDays));

  await Promise.all(expired.map(snippet => documentClient.send(new UpdateCommand({
    TableName: tableName,
    Key: { id: snippet.id },
    UpdateExpression: 'SET #featured = :false, updatedAt = :updatedAt',
    ConditionExpression: '#featured = :true',
    ExpressionAttributeNames: { '#featured': 'featured' },
    ExpressionAttributeValues: {
      ':true': true,
      ':false': false,
      ':updatedAt': new Date().toISOString(),
    },
  }))));

  return { checked: snippets.length, expired: expired.length, durationDays };
};