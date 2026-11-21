import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveFfbClubIdentity } from './ffb-club-identity';

describe('FFB club identity', () => {
  it('preserves legacy configurations and uses an explicitly configured club', () => {
    assert.deepEqual(resolveFfbClubIdentity({}), {
      identity: { code: '5500020', organizationId: '1403' }, legacy: true,
    });
    assert.deepEqual(resolveFfbClubIdentity({ ffb_club_code: '5500055', ffb_organization_id: '1438' }), {
      identity: { code: '5500055', organizationId: '1438' }, legacy: false,
    });
  });

  it('rejects incomplete and malformed identities instead of falling back', () => {
    assert.throws(() => resolveFfbClubIdentity({ ffb_club_code: '5500055' }));
    assert.throws(() => resolveFfbClubIdentity({ ffb_club_code: 'invalid', ffb_organization_id: '1438' }));
    assert.throws(() => resolveFfbClubIdentity(null));
  });
});
