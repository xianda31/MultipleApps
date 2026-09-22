import { findTournamentImageUrl, normalizeTournamentText } from './tournament-thumbnail.util';

describe('tournament thumbnail utilities', () => {
  it('normalizes case, accents, ligatures and punctuation', () => {
    expect(normalizeTournamentText('  COUPE d’ŒUVRE - ÉTÉ  ')).toBe('coupe d oeuvre ete');
  });

  it('matches a keyword regardless of case and accents', () => {
    const mapping = { simultane: 'simultane.webp' };

    expect(findTournamentImageUrl('SIMULTANÉ du Roy René', mapping)).toBe('simultane.webp');
    expect(findTournamentImageUrl('Simultane du Roy Rene', mapping)).toBe('simultane.webp');
  });

  it('matches equivalent punctuation and ligatures', () => {
    const mapping = { 'chef-d’œuvre': 'oeuvre.webp' };

    expect(findTournamentImageUrl('Tournoi CHEF D OEUVRE', mapping)).toBe('oeuvre.webp');
  });

  it('uses the default image when no keyword matches', () => {
    expect(findTournamentImageUrl('Tournoi libre', {
      simultane: 'simultane.webp',
      '__default__': 'default.webp',
    })).toBe('default.webp');
  });
});