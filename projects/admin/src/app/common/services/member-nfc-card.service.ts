import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../../../amplify/data/resource';
import { z } from 'zod';

export type MemberNfcCard = Schema['MemberNfcCard']['type'];
export const readerStatusSchema = z.object({
  version: z.string(), readerStatus: z.enum(['Starting', 'Ready', 'CardRead', 'Disconnected', 'Error']),
  readerName: z.string().nullable(), message: z.string(), capturing: z.boolean(),
});
export type NfcReaderStatus = z.infer<typeof readerStatusSchema>;

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

  async acquire(signal: AbortSignal): Promise<string> {
    const body = await this.bridge('capture', signal);
    if (typeof body !== 'object' || body === null || !('uid' in body) || typeof body.uid !== 'string') {
      throw new Error('Réponse ppNFC invalide : UID absent.');
    }
    return normalizeNtag213Uid(body.uid);
  }

  async status(signal: AbortSignal): Promise<NfcReaderStatus> {
    return readerStatusSchema.parse(await this.bridge('status', signal));
  }

  private async bridge(path: 'capture' | 'status', signal: AbortSignal): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`http://127.0.0.1:17835/${path}`, {
        method: 'POST',
        headers: { 'X-ppNFC-Editor': '1' },
        signal,
        cache: 'no-store',
        credentials: 'omit',
      });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new Error(
        'Liaison ppNFC impossible. Vérifiez que ppNFC est lancé sur ce PC, que ce site est autorisé '
        + 'dans sa configuration et que le navigateur autorise les connexions au réseau local.',
        { cause: error },
      );
    }
    if (path === 'status' && response.status === 404) {
      throw new Error('Cette version de ppNFC ne fournit pas le contrôle d’état. Mettez à jour puis relancez ppNFC.');
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      throw new Error(response.ok
        ? 'Réponse ppNFC invalide : contenu JSON attendu.'
        : `Erreur ppNFC (${response.status}) : réponse vide ou non JSON.`, { cause: error });
    }
    if (!response.ok) {
      const message = typeof body === 'object' && body !== null && 'message' in body
        && typeof body.message === 'string' ? body.message : `Erreur ppNFC (${response.status}).`;
      throw new Error(message);
    }
    return body;
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
