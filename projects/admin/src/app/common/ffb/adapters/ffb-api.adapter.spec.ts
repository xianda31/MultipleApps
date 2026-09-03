import { toClubMemberList } from './ffb-api.adapter';

describe('toClubMemberList', () => {
  function payloadWith(flag: Record<string, boolean>) {
    return {
      items: [{
        id: 1,
        ffbId: 123456,
        firstName: 'Jean',
        lastName: 'Abélanet',
        gender: 'M',
        birthdate: '1950-01-01',
        ...flag,
      }],
    };
  }

  it('reads the current licence flag', () => {
    expect(toClubMemberList(payloadWith({ licence: true }))[0].licence).toBeTrue();
  });

  it('accepts the licensee flag returned by newer FFB payloads', () => {
    expect(toClubMemberList(payloadWith({ licensee: true }))[0].licence).toBeTrue();
  });

  it('accepts the clubLicensee flag returned by detailed FFB payloads', () => {
    expect(toClubMemberList(payloadWith({ clubLicensee: true }))[0].licence).toBeTrue();
  });
});