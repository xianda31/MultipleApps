import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../../../amplify/data/resource';
import { z } from 'zod';

export type MemberNfcCard = Schema['MemberNfcCard']['type'];
export const readerStatusSchema = z.object({
  version: z.string(), readerStatus: z.enum(['Starting', 'Ready', 'CardRead', 'Disconnected', 'Error']),
  readerName: z.string().nullable(), message: z.string(), capturing: z.boolean(),
  hardwareProbe: z.object({
    state: z.enum(['Unverified', 'Responsive', 'Unresponsive']),
    pcdPiccStatus: z.number().int().nullable(),
    message: z.string(),
    checkedAt: z.string(),
  }).nullable().optional(),
});
export type NfcReaderStatus = z.infer<typeof readerStatusSchema>;

export class NfcCaptureTimeoutError extends Error {}

export function normalizeNtag213Uid(value: string): string {
  const uid = value.trim().toUpperCase();
  if (!/^[0-9A-F]{14}$/.test(uid)) {
    throw new Error('Une carte NTAG213 doit fournir un UID hexadécimal de 7 octets.');
  }
  return uid;
}

@Injectable({ providedIn: 'root' })
export class MemberNfcCardService {
  private get client() {
    return generateClient<Schema>({ authMode: 'userPool' });
  }

  async list(licenseNumber: string): Promise<MemberNfcCard[]> {
    const cards: MemberNfcCard[] = [];
    const client = this.client;
    let nextToken: string | null | undefined;
    do {
      const result = await client.models.MemberNfcCard.memberNfcCardsByLicense(
        { licenseNumber }, { nextToken },
      );
      if (result.errors?.length) throw new Error(result.errors.map(error => error.message).join('; '));
      cards.push(...result.data);
      nextToken = result.nextToken;
    } while (nextToken);
    return cards.sort((left, right) => left.uid.localeCompare(right.uid));
  }

  async get(uid: string): Promise<MemberNfcCard | null> {
    const result = await this.client.models.MemberNfcCard.get({ uid: normalizeNtag213Uid(uid) });
    if (result.errors?.length) throw new Error(result.errors.map(error => error.message).join('; '));
    return result.data;
  }

}
