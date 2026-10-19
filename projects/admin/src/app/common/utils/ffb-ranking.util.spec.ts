import { getFfbRankingCodeParts } from './ffb-ranking.util';

describe('getFfbRankingCodeParts', () => {
  it('extracts and colors red suits', () => {
    expect(getFfbRankingCodeParts('3♥')).toEqual({
      series: '3',
      suit: '♥',
      suitColor: '#d32f2f',
      tail: '',
    });
  });

  it('extracts and colors black suits', () => {
    expect(getFfbRankingCodeParts('2♠')).toEqual({
      series: '2',
      suit: '♠',
      suitColor: '#000',
      tail: '',
    });
  });

  it('keeps non-suit ranking suffixes', () => {
    expect(getFfbRankingCodeParts('1N')).toEqual({
      series: '1',
      suit: '',
      suitColor: '#000',
      tail: 'N',
    });
  });
});
