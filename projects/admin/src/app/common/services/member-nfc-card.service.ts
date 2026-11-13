import { Injectable } from '@angular/core';
import { getCurrentUser } from '@aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { GraphQLQuery } from 'aws-amplify/api';
import type { Schema } from '../../../../../../amplify/data/resource';
import type { Member } from '../interfaces/member.interface';

export type MemberNfcCard = Schema['MemberNfcCard']['type'];

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
    let response: Response;
    try {
      response = await fetch('http://127.0.0.1:17835/capture', {
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
    const body: unknown = await response.json();
    if (!response.ok) {
      const message = typeof body === 'object' && body !== null && 'message' in body
        && typeof body.message === 'string' ? body.message : `Erreur ppNFC (${response.status}).`;
      throw new Error(message);
    }
    if (typeof body !== 'object' || body === null || !('uid' in body) || typeof body.uid !== 'string') {
      throw new Error('Réponse ppNFC invalide : UID absent.');
    }
    return normalizeNtag213Uid(body.uid);
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

  async assign(uid: string, member: Member, previous: MemberNfcCard | null): Promise<MemberNfcCard> {
    const normalized = normalizeNtag213Uid(uid);
    if (previous && previous.uid !== normalized) throw new Error('La carte a changé. Relisez-la.');
    if (previous && previous.licenseNumber !== member.license_number && previous.status !== 'DISABLED') {
      throw new Error('Désactivez la carte avant de la réattribuer à un autre adhérent.');
    }
    await this.ensureActiveMember(member);
    const { userId } = await getCurrentUser();
    const input = {
      uid: normalized,
      licenseNumber: member.license_number,
      status: 'ACTIVE' as const,
      assignedAt: new Date().toISOString(),
      assignedBy: userId,
    };
    if (previous) return this.update(previous, input);
    const result = await this.client.models.MemberNfcCard.create(input);
    if (result.errors?.length) throw new Error(result.errors.map(error => error.message).join('; '));
    if (!result.data) throw new Error('La carte n’a pas été enregistrée.');
    return result.data;
  }

  async deactivate(card: MemberNfcCard): Promise<MemberNfcCard> {
    return this.update(card, { uid: card.uid, status: 'DISABLED' });
  }

  private async ensureActiveMember(member: Member): Promise<void> {
    const client = this.client;
    const matches: Schema['Member']['type'][] = [];
    let nextToken: string | null | undefined;
    do {
      const result = await client.models.Member.list({
        filter: { license_number: { eq: member.license_number } }, nextToken,
      });
      if (result.errors?.length) throw new Error(result.errors.map(error => error.message).join('; '));
      matches.push(...result.data);
      nextToken = result.nextToken;
    } while (nextToken);
    if (!member.license_number.trim() || matches.length !== 1 || matches[0].id !== member.id) {
      throw new Error('Licence inconnue ou ambiguë. Actualisez le répertoire avant l’attribution.');
    }
    if (matches[0].lifecycleStatus !== 'ACTIVE') {
      throw new Error('Une carte ne peut être activée que pour un adhérent explicitement actif.');
    }
  }

  private async update(
    previous: MemberNfcCard,
    input: { uid: string; status: 'ACTIVE' | 'DISABLED'; licenseNumber?: string; assignedAt?: string; assignedBy?: string },
  ): Promise<MemberNfcCard> {
    if (!previous.updatedAt) throw new Error('Version de carte absente. Rechargez les cartes.');
    const result = await this.client.graphql<GraphQLQuery<{ updateMemberNfcCard: MemberNfcCard | null }>>({
      query: `mutation UpdateNfcCard($input: UpdateMemberNfcCardInput!, $condition: ModelMemberNfcCardConditionInput) {
        updateMemberNfcCard(input: $input, condition: $condition) {
          uid licenseNumber status assignedAt assignedBy createdAt updatedAt
        }
      }`,
      variables: {
        input,
        condition: {
          licenseNumber: { eq: previous.licenseNumber },
          status: { eq: previous.status },
          updatedAt: { eq: previous.updatedAt },
        },
      },
    });
    if (result.errors?.length) throw new Error(result.errors.map(error => error.message).join('; '));
    if (!result.data.updateMemberNfcCard) throw new Error('Modification non confirmée. Rechargez les cartes.');
    return result.data.updateMemberNfcCard;
  }
}
