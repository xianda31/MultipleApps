import { LicenseStatus, Member } from '../interfaces/member.interface';
import { activeMembersCsvFileName, buildActiveMembersCsv } from './active-members-csv.util';

function member(overrides: Partial<Member>): Member {
  return {
    id: 'member',
    gender: 'U',
    firstname: 'Alice',
    lastname: 'DUPONT',
    license_number: '00123456',
    birthdate: '1970-01-01',
    license_status: LicenseStatus.DULY_REGISTERED,
    license_taken_at: 'BCSTO',
    membership_date: '2026-09-01',
    register_date: '2026-08-15',
    city: 'Saint-Orens',
    email: 'alice@example.fr',
    phone_one: '0102030405',
    accept_mailing: true,
    lifecycleStatus: 'ACTIVE',
    ...overrides,
  };
}

describe('active members CSV export', () => {
  it('exports active and legacy-active members only, sorted by name', () => {
    const csv = buildActiveMembersCsv([
      member({ id: 'archived', lastname: 'ARCHIVE', lifecycleStatus: 'ARCHIVED' }),
      member({ id: 'second', lastname: 'ZOLA', firstname: 'Zoé' }),
      member({ id: 'legacy', lastname: 'MARTIN', firstname: 'Marc', lifecycleStatus: undefined }),
    ]);

    expect(csv).not.toContain('ARCHIVE');
    expect(csv.indexOf('MARTIN')).toBeLessThan(csv.indexOf('ZOLA'));
    expect(csv).toContain('"Licencié"');
    expect(csv).toContain('"Oui"');
  });

  it('escapes quotes, flattens line breaks and neutralizes spreadsheet formulas', () => {
    const csv = buildActiveMembersCsv([
      member({
        lastname: '=IMPORTXML("https://example.test")',
        birthdate: '1970-01-01T23:00:00.000Z',
        city: 'Saint-\nOrens',
        phone_one: '0123456789',
      }),
    ]);

    expect(csv).toContain('"\'=IMPORTXML(""https://example.test"")"');
    expect(csv).toContain('"01/01/1970"');
    expect(csv).not.toContain('23:00:00');
    expect(csv).toContain('"Saint- Orens"');
    expect(csv).toContain('"01 23 45 67 89"');
  });

  it('builds a locally dated filename', () => {
    expect(activeMembersCsvFileName(new Date(2026, 9, 13))).toBe('membres-actifs-2026-10-13.csv');
  });
});
