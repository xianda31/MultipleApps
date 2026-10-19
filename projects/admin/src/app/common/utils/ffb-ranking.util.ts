export type FfbRankingCodeParts = {
  series: string;
  suit: string;
  suitColor: string;
  tail: string;
};

export function getFfbRankingCodeParts(code: string): FfbRankingCodeParts {
  const match = code.match(/^(\d*)([♥♦♣♠]?)(.*)$/);
  if (!match) {
    return { series: code, suit: '', suitColor: '#000', tail: '' };
  }

  const suit = match[2];
  return {
    series: match[1],
    suit,
    suitColor: suit === '♥' || suit === '♦' ? '#d32f2f' : '#000',
    tail: match[3],
  };
}
