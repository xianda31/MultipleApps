import { ClubMember } from '../interface/club-member.interface';

export function normalizePlayerSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .replace(/[-']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchesPlayerSearch(player: ClubMember, searchValue: string): boolean {
  const searchTokens = normalizePlayerSearchText(searchValue).split(' ').filter(Boolean);
  if (searchTokens.length === 0) {
    return true;
  }

  const club = player.club?.label || player.club?.name || player.club?.ffbCode || '';
  const playerTokens = normalizePlayerSearchText(
    `${player.lastName} ${player.firstName} ${player.license_number} ${club}`
  ).split(' ');

  return searchTokens.every(searchToken =>
    playerTokens.some(playerToken => playerToken.startsWith(searchToken))
  );
}

export function rankPlayerSearchResults(players: ClubMember[], searchValue: string): ClubMember[] {
  const normalizedSearch = normalizePlayerSearchText(searchValue);

  return [...players].sort((left, right) => {
    const leftLastFirst = normalizePlayerSearchText(`${left.lastName} ${left.firstName}`);
    const leftFirstLast = normalizePlayerSearchText(`${left.firstName} ${left.lastName}`);
    const rightLastFirst = normalizePlayerSearchText(`${right.lastName} ${right.firstName}`);
    const rightFirstLast = normalizePlayerSearchText(`${right.firstName} ${right.lastName}`);
    const leftExact = leftLastFirst === normalizedSearch || leftFirstLast === normalizedSearch;
    const rightExact = rightLastFirst === normalizedSearch || rightFirstLast === normalizedSearch;

    if (leftExact !== rightExact) {
      return leftExact ? -1 : 1;
    }

    return leftLastFirst.localeCompare(rightLastFirst, 'fr', { sensitivity: 'base' });
  });
}
