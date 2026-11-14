import type {
  NfcCard, NfcMember, CardRequest, ImportRow, ImportCheck,
} from '../../../../../common/nfc-contract';
export type {
  NfcCard, NfcMember, CardRequest, ImportRow, ImportCheck, ImportBatch, NfcHistory,
} from '../../../../../common/nfc-contract';

export class NfcError extends Error {}

export type CardAction = 'REGISTER_WHITE' | 'ASSIGN' | 'DISABLE' | 'RETURN'
  | 'LOST' | 'RETIRED' | 'CLASSIFY_WHITE' | 'CLASSIFY_PERSONAL';

export function text(value: unknown, label: string, max = 160): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new NfcError(`${label} absent ou invalide.`);
  }
  return value.trim();
}

export function normalizeUid(value: unknown): string {
  const uid = text(value, 'UID', 14).toUpperCase();
  if (!/^[0-9A-F]{14}$/.test(uid)) throw new NfcError('UID NTAG213 attendu : 14 caractères hexadécimaux.');
  return uid;
}

export function activeMember(members: NfcMember[], license: string): NfcMember {
  const matches = members.filter(member => member.license_number === license);
  if (matches.length !== 1) throw new NfcError('Licence inconnue ou ambiguë.');
  if (matches[0].lifecycleStatus !== 'ACTIVE') throw new NfcError('Le titulaire doit être explicitement actif.');
  return matches[0];
}

export function changeCard(
  action: CardAction, uid: string, previous: NfcCard | undefined, license: string | undefined,
  members: NfcMember[], actor: string, now: string,
): NfcCard {
  const card: NfcCard = previous ? { ...previous, updatedAt: now } : {
    uid, status: 'DISABLED', createdAt: now, updatedAt: now,
  };
  if (action === 'REGISTER_WHITE') {
    if (previous) throw new NfcError('Carte déjà connue : utilisez son dossier.');
    return { ...card, kind: 'WHITE', stockState: 'AVAILABLE' };
  }
  if (action === 'ASSIGN') {
    const owner = activeMember(members, text(license, 'Licence'));
    if (previous?.stockState === 'LOST' || previous?.stockState === 'RETIRED') {
      throw new NfcError('Carte perdue ou hors service : attribution interdite.');
    }
    if (previous?.licenseNumber && previous.licenseNumber !== owner.license_number) {
      if (previous.kind === 'WHITE') throw new NfcError('Restituez la carte blanche avant un nouveau prêt.');
      if (previous.status === 'ACTIVE') throw new NfcError('Désactivez la carte avant de la réattribuer.');
    }
    return {
      ...card, kind: card.kind ?? 'PERSONAL', stockState: 'ASSIGNED', status: 'ACTIVE',
      licenseNumber: owner.license_number, assignedAt: now, assignedBy: actor,
    };
  }
  if (!previous) throw new NfcError('Carte inconnue.');
  if (action === 'CLASSIFY_WHITE' || action === 'CLASSIFY_PERSONAL') {
    if (previous.kind) throw new NfcError('Le type de cette carte est déjà défini.');
    return { ...card, kind: action === 'CLASSIFY_WHITE' ? 'WHITE' : 'PERSONAL', stockState: previous.stockState ?? 'ASSIGNED' };
  }
  if (action === 'RETURN') {
    if (previous.kind !== 'WHITE' || previous.stockState === 'RETIRED'
      || previous.stockState === 'AVAILABLE') throw new NfcError('Cette carte ne peut pas être remise en stock.');
    delete card.licenseNumber;
    delete card.assignedAt;
    delete card.assignedBy;
    return { ...card, stockState: 'AVAILABLE', status: 'DISABLED' };
  }
  if (action === 'DISABLE') {
    if (previous.status !== 'ACTIVE') throw new NfcError('Carte déjà désactivée.');
    return { ...card, status: 'DISABLED' };
  }
  if (action === 'LOST' || action === 'RETIRED') {
    return { ...card, status: 'DISABLED', stockState: action };
  }
  throw new NfcError('Action carte inconnue.');
}

function sameName(left: string, right: string | null | undefined): boolean {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[-'’\s]+/g, ' ').trim();
  return normalize(left) === normalize(right ?? '');
}

export function validateImport(
  rows: ImportRow[], expected: number, members: NfcMember[], cards: NfcCard[],
): ImportCheck[] {
  if (!rows.length || rows.length > 500 || !Number.isInteger(expected) || expected !== rows.length) {
    throw new NfcError('Le lot doit contenir 1 à 500 cartes et correspondre à la quantité attendue.');
  }
  const seen = new Set<string>();
  return rows.map((row, index) => {
    const check: ImportCheck = { ...row, line: index + 2, outcome: 'CREATE', message: 'Nouvelle attribution' };
    try {
      check.uid = normalizeUid(row.uid);
      check.licenseNumber = text(row.licenseNumber, 'Licence');
      check.firstname = text(row.firstname, 'Prénom');
      check.lastname = text(row.lastname, 'Nom');
      if (seen.has(check.uid)) throw new NfcError('UID présent plusieurs fois dans le fichier.');
      seen.add(check.uid);
      const member = activeMember(members, check.licenseNumber);
      if (!sameName(check.firstname, member.firstname) || !sameName(check.lastname, member.lastname)) {
        throw new NfcError('Nom/prénom différents du répertoire : vérifier le fichier.');
      }
      const card = cards.find(card => card.uid === check.uid);
      if (card) {
        if (card.licenseNumber !== check.licenseNumber || card.status !== 'ACTIVE'
          || card.kind === 'WHITE' || card.stockState === 'LOST' || card.stockState === 'RETIRED') {
          throw new NfcError('Carte déjà connue avec une attribution, un type ou un état incompatible.');
        }
        check.outcome = 'SKIP';
        check.message = 'Association identique déjà présente';
      }
    } catch (error) {
      if (!(error instanceof NfcError)) throw error;
      check.outcome = 'ERROR';
      check.message = error.message;
    }
    return check;
  });
}

export function changeRequest(
  previous: CardRequest | undefined, licenseNumber: string, stage: CardRequest['stage'],
  members: NfcMember[], now: string, orderReference?: string, orderQuantity?: number, card?: NfcCard,
): CardRequest {
  const transitions: Record<CardRequest['stage'], CardRequest['stage'][]> = {
    REQUESTED: ['ORDERED', 'CANCELLED'],
    ORDERED: ['RECEIVED', 'CANCELLED'],
    RECEIVED: ['DELIVERED', 'CANCELLED'],
    DELIVERED: ['REQUESTED'],
    CANCELLED: ['REQUESTED'],
  };
  if ((!previous && stage !== 'REQUESTED') || (previous && !transitions[previous.stage].includes(stage))) {
    throw new NfcError('Transition de commande invalide. Actualisez la page.');
  }
  if (stage !== 'CANCELLED') activeMember(members, licenseNumber);
  if (stage === 'REQUESTED') return { licenseNumber, stage, createdAt: previous?.createdAt ?? now, updatedAt: now };
  const next: CardRequest = { ...previous!, licenseNumber, stage, updatedAt: now };
  if (stage === 'ORDERED') {
    next.orderReference = text(orderReference, 'Référence de commande');
    if (!Number.isInteger(orderQuantity) || orderQuantity! < 10) {
      throw new NfcError('La commande fournisseur doit comporter au moins 10 cartes.');
    }
    next.orderQuantity = orderQuantity;
  }
  if (stage === 'RECEIVED' || stage === 'DELIVERED') {
    if (!card || card.licenseNumber !== licenseNumber || card.status !== 'ACTIVE' || card.kind !== 'PERSONAL') {
      throw new NfcError('Une carte définitive active attribuée à cet adhérent est requise.');
    }
    next.uid = card.uid;
  }
  return next;
}
