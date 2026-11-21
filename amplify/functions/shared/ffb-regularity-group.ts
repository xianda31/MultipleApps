import { FfbClubIdentity } from './ffb-club-identity';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function resolveFfbRegularityGroup(data: unknown, identity: FfbClubIdentity): number {
  if (!isRecord(data) || !Array.isArray(data['items'])
    || !isRecord(data['pagination']) || data['pagination']['has_next_page'] !== false) {
    throw new Error('Réponse FFB des résultats de club invalide ou incomplète');
  }

  const groups: number[] = [];
  for (const item of data['items']) {
    if (!isRecord(item) || !isRecord(item['organization']) || item['organization']['ffbCode'] !== identity.code
      || String(item['organization']['id']) !== identity.organizationId || !Array.isArray(item['phases'])) {
      throw new Error('Résultats FFB du club invalides');
    }
    for (const phase of item['phases']) {
      if (!isRecord(phase) || !Array.isArray(phase['groups'])) {
        throw new Error('Groupes FFB invalides');
      }
      for (const group of phase['groups']) {
        if (isRecord(group) && group['label'] === 'A') {
          if (typeof group['id'] !== 'number' || !Number.isSafeInteger(group['id']) || group['id'] <= 0) {
            throw new Error('Identifiant du groupe FFB invalide');
          }
          groups.push(group['id']);
        }
      }
    }
  }
  if (groups.length !== 1) {
    throw new Error(`Impossible d'identifier un groupe FFB de régularité unique (${groups.length} trouvés)`);
  }
  return groups[0];
}
