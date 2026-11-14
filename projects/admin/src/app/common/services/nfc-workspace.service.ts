import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../../../amplify/data/resource';
import {
  cardRequestSchema, importBatchSchema, historySchema, nfcCardSchema, nfcChangeSchema, nfcMemberSchema,
  type CardRequest, type ImportBatch, type ImportCheck, type ImportRow, type NfcCard,
  type NfcChange, type NfcHistory, type NfcSnapshot,
} from '../../../../../common/nfc-contract';
import { changeCard, changeRequest, normalizeUid, validateImport, type CardAction } from '../../back/nfc/nfc-domain';

function json(value: unknown): unknown {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

async function pages<T>(load: (nextToken?: string | null) => Promise<{
  data: T[]; nextToken?: string | null; errors?: { message: string }[];
}>): Promise<T[]> {
  const all: T[] = [];
  let nextToken: string | null | undefined;
  do {
    const result = await load(nextToken);
    if (result.errors?.length) throw new Error(result.errors.map(error => error.message).join('; '));
    all.push(...result.data);
    nextToken = result.nextToken;
  } while (nextToken);
  return all;
}

@Injectable({ providedIn: 'root' })
export class NfcWorkspaceService {
  private get client() { return generateClient<Schema>({ authMode: 'userPool' }); }

  async snapshot(): Promise<NfcSnapshot> {
    const models = this.client.models;
    const [cards, members, requests, batches] = await Promise.all([
      pages(token => models.MemberNfcCard.list({ nextToken: token })),
      pages(token => models.Member.list({ nextToken: token })),
      pages(token => models.NfcCardRequest.list({ nextToken: token })),
      pages(token => models.NfcImportBatch.list({ nextToken: token })),
    ]);
    return {
      cards: cards.map(card => nfcCardSchema.parse(card)),
      members: members.map(member => nfcMemberSchema.parse(member)),
      requests: requests.map(request => cardRequestSchema.parse(request)),
      batches: batches.map(batch => importBatchSchema.parse({
        ...batch, rows: json(batch.rows), results: json(batch.results),
      })),
    };
  }

  async summary(licenseNumber: string): Promise<{ cards: NfcCard[]; request: CardRequest | null }> {
    const models = this.client.models;
    const [cards, request] = await Promise.all([
      pages(token => models.MemberNfcCard.memberNfcCardsByLicense({ licenseNumber }, { nextToken: token })),
      models.NfcCardRequest.get({ licenseNumber }),
    ]);
    if (request.errors?.length) throw new Error(request.errors.map(error => error.message).join('; '));
    return {
      cards: cards.map(card => nfcCardSchema.parse(card)),
      request: request.data ? cardRequestSchema.parse(request.data) : null,
    };
  }

  async history(subject: string): Promise<NfcHistory[]> {
    const entries = await pages(token => this.client.models.NfcHistory.nfcHistoryBySubject(
      { subject }, { nextToken: token },
    ));
    return entries.map(entry => historySchema.parse({ ...entry, before: json(entry.before), after: json(entry.after) }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async commit(action: string, changes: NfcChange[], cardChecks: { uid: string; updatedAt: string }[] = []): Promise<NfcChange[]> {
    const result = await this.client.mutations.manageNfc({ input: JSON.stringify({ action, changes, cardChecks }) });
    if (result.errors?.length) throw new Error(result.errors.map(error => error.message).join('; '));
    const data: unknown = json(result.data);
    if (!Array.isArray(data)) throw new Error('Enregistrement NFC non confirmé. Actualisez avant de réessayer.');
    return data.map(change => nfcChangeSchema.parse(change));
  }

  async card(action: CardAction, uid: string, snapshot: NfcSnapshot, license?: string): Promise<void> {
    uid = normalizeUid(uid);
    const previous = snapshot.cards.find(card => card.uid === uid);
    const record = changeCard(action, uid, previous, license, snapshot.members, '', new Date().toISOString());
    await this.commit(action, [{ entity: 'card', expectedVersion: previous?.updatedAt ?? null, record }]);
  }

  async request(
    license: string, stage: CardRequest['stage'], snapshot: NfcSnapshot,
    orderReference?: string, orderQuantity?: number, uid?: string,
  ): Promise<void> {
    const previous = snapshot.requests.find(request => request.licenseNumber === license);
    const record = changeRequest(previous, license, stage, snapshot.members, new Date().toISOString(),
      orderReference, orderQuantity, snapshot.cards.find(card => card.uid === uid));
    await this.commit(`REQUEST_${stage}`, [{ entity: 'request', expectedVersion: previous?.updatedAt ?? null, record }]);
  }

  preview(rows: ImportRow[], expected: number, snapshot: NfcSnapshot): ImportCheck[] {
    return validateImport(rows, expected, snapshot.members, snapshot.cards);
  }

  async createBatch(filename: string, rows: ImportRow[], expected: number): Promise<ImportBatch> {
    const snapshot = await this.snapshot();
    const checked = this.preview(rows, expected, snapshot);
    if (checked.some(row => row.outcome === 'ERROR')) throw new Error('Le lot contient des anomalies. Relancez la prévalidation.');
    if (new TextEncoder().encode(JSON.stringify(checked)).length > 140_000) {
      throw new Error('Lot trop volumineux pour conserver son rapport. Scindez le fichier.');
    }
    const now = new Date().toISOString();
    const record: ImportBatch = {
      id: crypto.randomUUID(), filename, rows: checked, results: [], cursor: 0, actor: '', createdAt: now, updatedAt: now,
    };
    const [saved] = await this.commit('IMPORT_START', [{ entity: 'batch', expectedVersion: null, record }]);
    if (saved.entity !== 'batch') throw new Error('Réponse de création du lot invalide.');
    return saved.record;
  }

  async importNext(batch: ImportBatch, snapshot: NfcSnapshot): Promise<ImportBatch> {
    if (batch.cursor >= batch.rows.length) throw new Error('Import déjà terminé.');
    const row = batch.rows[batch.cursor];
    const result = { ...this.preview([row], 1, snapshot)[0], line: row.line };
    const changes: NfcChange[] = [];
    if (result.outcome === 'CREATE') {
      const card = changeCard('ASSIGN', result.uid, undefined, result.licenseNumber,
        snapshot.members, '', new Date().toISOString());
      changes.push({ entity: 'card', expectedVersion: null, record: card });
    }
    const next: ImportBatch = { ...batch, cursor: batch.cursor + 1, results: [...batch.results, result] };
    changes.push({ entity: 'batch', expectedVersion: batch.updatedAt, record: next });
    const existing = snapshot.cards.find(card => card.uid === result.uid);
    const checks = result.outcome === 'SKIP' && existing ? [{ uid: existing.uid, updatedAt: existing.updatedAt }] : [];
    const saved = await this.commit('IMPORT_ROW', changes, checks);
    const updated = saved.find(change => change.entity === 'batch');
    if (!updated || updated.entity !== 'batch') throw new Error('Progression de l’import non confirmée.');
    return updated.record;
  }
}
