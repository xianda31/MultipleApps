import { determineGameCardNotification } from './game-card-notification.util';

describe('game card notification decision', () => {
  it('reports an exhausted card when another card remains', () => {
    expect(determineGameCardNotification(1, 8, 5, 4, 2)).toBe('card-exhausted');
  });

  it('reports that all cards are exhausted when no credit remains', () => {
    expect(determineGameCardNotification(1, 0, 1, 0, 2)).toBe('all-exhausted');
  });

  it('reports a newly crossed low-credit threshold', () => {
    expect(determineGameCardNotification(0, 2, 3, 2, 2)).toBe('low-credit');
  });

  it('does not repeat a low-credit notification below the threshold', () => {
    expect(determineGameCardNotification(0, 1, 2, 1, 2)).toBe('none');
  });
});