import { FormControl } from '@angular/forms';

import { isFuturePublicationDate, localDateValue, noFuturePublicationDate } from './publication-date';

describe('publication date', () => {
  it('formats a date for a local date input', () => {
    expect(localDateValue(new Date(2026, 8, 20))).toBe('2026-09-20');
  });

  it('rejects publication dates after today', () => {
    expect(isFuturePublicationDate('2026-09-21', '2026-09-20')).toBeTrue();
    expect(isFuturePublicationDate('2026-09-20', '2026-09-20')).toBeFalse();
    expect(noFuturePublicationDate(new FormControl('2999-01-01'))).toEqual({ futurePublicationDate: true });
  });
});