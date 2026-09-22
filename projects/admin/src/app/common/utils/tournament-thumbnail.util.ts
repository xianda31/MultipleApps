type TournamentImageValue = string | { url?: string; presigned_url?: string } | null | undefined;

const DEFAULT_KEYS = new Set(['defaut', 'default', 'fallback']);

export function normalizeTournamentText(value: string): string {
  return (value || '')
    .toLocaleLowerCase('fr-FR')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function findTournamentImageUrl(
  tournamentTitle: string,
  mapping: Record<string, TournamentImageValue> | null | undefined,
): string | null {
  if (!mapping) return null;

  const normalizedTitle = normalizeTournamentText(tournamentTitle);
  for (const [keyword, value] of Object.entries(mapping)) {
    const normalizedKeyword = normalizeTournamentText(keyword);
    if (!normalizedKeyword || DEFAULT_KEYS.has(normalizedKeyword)) continue;
    if (normalizedTitle.includes(normalizedKeyword)) {
      const url = imageUrlOf(value);
      if (url) return url;
    }
  }

  for (const [keyword, value] of Object.entries(mapping)) {
    if (DEFAULT_KEYS.has(normalizeTournamentText(keyword))) {
      const url = imageUrlOf(value);
      if (url) return url;
    }
  }

  return null;
}

function imageUrlOf(value: TournamentImageValue): string | null {
  if (typeof value === 'string') return value;
  return value?.url || value?.presigned_url || null;
}