import { ClubMember } from '../interface/club-member.interface';
import { matchesPlayerSearch, normalizePlayerSearchText, rankPlayerSearchResults } from './player-search.util';

function player(id: number, lastName: string, firstName: string): ClubMember {
  return {
    id,
    license_number: String(id).padStart(8, '0'),
    firstName,
    lastName,
    gender: 'F',
    birthdate: '',
    club: {
      id: 1,
      ffbCode: '5500020',
      name: 'Club test',
      label: 'Club test',
      committee: { id: 1, label: '', zone: { id: 1, label: '' } },
      type: '',
    },
    licence: true,
    season: { id: 38, category: 'senior' },
    mainRegistration: { free: false },
  };
}

describe('player search utilities', () => {
  const jocelyne = player(1, 'CLÉMENT', 'Jocelyne');

  it('normalizes accents, punctuation and whitespace', () => {
    expect(normalizePlayerSearchText('  Clément-Dupont  ')).toBe('clement dupont');
  });

  it('matches a player without requiring accents or name order', () => {
    expect(matchesPlayerSearch(jocelyne, 'CLEMENT Jocelyne')).toBeTrue();
    expect(matchesPlayerSearch(jocelyne, 'Jocelyne Clement')).toBeTrue();
    expect(matchesPlayerSearch(jocelyne, 'joc clem')).toBeTrue();
  });

  it('does not match unrelated players', () => {
    expect(matchesPlayerSearch(jocelyne, 'HADD Pierre')).toBeFalse();
  });

  it('ranks an exact normalized name before partial matches', () => {
    const players = [
      player(2, 'CLÉMENT', 'Jean-Jocelyne'),
      jocelyne,
    ];

    expect(rankPlayerSearchResults(players, 'Clement Jocelyne')[0].id).toBe(jocelyne.id);
  });
});
