import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { featuredDurationDays, isFeaturedExpired } from './handler';

describe('expire featured snippets', () => {
  it('reads and validates the configured duration', () => {
    assert.equal(featuredDurationDays({ homepage: { featured_duration_days: 45 } }), 45);
    assert.equal(featuredDurationDays({ homepage: { featured_duration_days: 0 } }), 30);
    assert.equal(featuredDurationDays({}), 30);
  });

  it('expires a featured snippet after the configured duration', () => {
    const snippet = { id: 'snippet-1', featured: true, publishedAt: '2026-09-01' };
    assert.equal(isFeaturedExpired(snippet, 30, new Date('2026-09-30T23:59:59Z')), false);
    assert.equal(isFeaturedExpired(snippet, 30, new Date('2026-10-01T00:00:00Z')), true);
  });

  it('ignores snippets without a valid publication date', () => {
    assert.equal(isFeaturedExpired({ id: 'snippet-1', featured: true }, 30), false);
  });
});