import { z } from 'zod';

const label = z.string().trim().min(1).max(160);
const uid = z.string().regex(/^[0-9A-F]{14}$/);
const timestamps = { createdAt: z.string(), updatedAt: z.string() };

export const nfcCardSchema = z.object({
  uid, licenseNumber: label.nullish(),
  status: z.enum(['ACTIVE', 'DISABLED']),
  kind: z.enum(['WHITE', 'PERSONAL']).nullish(),
  stockState: z.enum(['AVAILABLE', 'ASSIGNED', 'LOST', 'RETIRED']).nullish(),
  assignedAt: z.string().nullish(), assignedBy: z.string().nullish(),
  ...timestamps,
});
export type NfcCard = z.infer<typeof nfcCardSchema>;

export const nfcMemberSchema = z.object({
  id: label, license_number: z.string(), firstname: z.string().nullish(),
  lastname: z.string().nullish(), lifecycleStatus: z.string().nullish(),
});
export type NfcMember = z.infer<typeof nfcMemberSchema>;

export const cardRequestSchema = z.object({
  licenseNumber: label,
  stage: z.enum(['REQUESTED', 'ORDERED', 'RECEIVED', 'DELIVERED', 'CANCELLED']),
  orderReference: label.nullish(), orderQuantity: z.number().int().min(10).nullish(), uid: uid.nullish(),
  ...timestamps,
});
export type CardRequest = z.infer<typeof cardRequestSchema>;

export const importRowSchema = z.object({
  uid: z.string().max(160), licenseNumber: z.string().max(160),
  firstname: z.string().max(160), lastname: z.string().max(160),
});
export type ImportRow = z.infer<typeof importRowSchema>;
export const importCheckSchema = importRowSchema.extend({
  line: z.number().int().min(2), outcome: z.enum(['CREATE', 'SKIP', 'ERROR']), message: z.string().max(500),
});
export type ImportCheck = z.infer<typeof importCheckSchema>;
export const importBatchSchema = z.object({
  id: z.string().uuid(), filename: label, actor: z.string(),
  rows: z.array(importCheckSchema).min(1).max(500),
  results: z.array(importCheckSchema).max(500), cursor: z.number().int().min(0).max(500),
  ...timestamps,
});
export type ImportBatch = z.infer<typeof importBatchSchema>;

export const historySchema = z.object({
  id: z.string(), subject: z.string(), action: z.string(), actor: z.string(),
  before: z.unknown(), after: z.unknown(), createdAt: z.string(),
});
export type NfcHistory = z.infer<typeof historySchema>;

const version = z.string().nullable();
export const nfcChangeSchema = z.discriminatedUnion('entity', [
  z.object({ entity: z.literal('card'), expectedVersion: version, record: nfcCardSchema }),
  z.object({ entity: z.literal('request'), expectedVersion: version, record: cardRequestSchema }),
  z.object({ entity: z.literal('batch'), expectedVersion: version, record: importBatchSchema }),
]);
export type NfcChange = z.infer<typeof nfcChangeSchema>;
export const nfcCommitSchema = z.object({
  action: label, changes: z.array(nfcChangeSchema).min(1).max(2),
  cardChecks: z.array(z.object({ uid, updatedAt: z.string().min(1) })).max(1).default([]),
});
export const nfcSnapshotSchema = z.object({
  cards: z.array(nfcCardSchema), members: z.array(nfcMemberSchema),
  requests: z.array(cardRequestSchema), batches: z.array(importBatchSchema),
});
export type NfcSnapshot = z.infer<typeof nfcSnapshotSchema>;
