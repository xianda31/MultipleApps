import { changeCard, changeRequest, validateImport, type NfcMember } from './nfc-domain';
import { importRows, parseCsv, csvReport } from './nfc-import';

describe('NFC workflows', () => {
  const uid = '04E50142E37384', now = '2026-11-14T10:00:00.000Z';
  const members: NfcMember[] = [
    { id: 'one', license_number: '00123456', firstname: 'Alex', lastname: 'Exemple', lifecycleStatus: 'ACTIVE' },
    { id: 'two', license_number: '00876543', firstname: 'Camille', lastname: 'Autre', lifecycleStatus: 'ACTIVE' },
  ];
  const row = { uid, licenseNumber: '00123456', firstname: 'Alex', lastname: 'Exemple' };

  it('recycles white cards only after explicit return and preserves disabled loans', () => {
    const stock = changeCard('REGISTER_WHITE', uid, undefined, undefined, members, 'operator', now);
    const loan = changeCard('ASSIGN', uid, stock, members[0].license_number, members, 'operator', now);
    const disabled = changeCard('DISABLE', uid, loan, undefined, members, 'operator', now);
    expect(disabled.stockState).toBe('ASSIGNED');
    expect(disabled.licenseNumber).toBe(members[0].license_number);
    expect(() => changeCard('ASSIGN', uid, disabled, members[1].license_number, members, 'operator', now))
      .toThrowError(/Restituez/);
    const returned = changeCard('RETURN', uid, disabled, undefined, members, 'operator', now);
    expect(returned.stockState).toBe('AVAILABLE');
    expect(returned.licenseNumber).toBeUndefined();
    expect(changeCard('ASSIGN', uid, returned, members[1].license_number, members, 'operator', now).licenseNumber)
      .toBe(members[1].license_number);
  });

  it('blocks inactive holders, active transfers and lost/retired cards', () => {
    const card = changeCard('ASSIGN', uid, undefined, row.licenseNumber, members, 'operator', now);
    expect(() => changeCard('ASSIGN', uid, card, members[1].license_number, members, 'operator', now)).toThrowError(/Désactivez/);
    for (const lifecycleStatus of ['ARCHIVED', 'BANNED', null]) {
      expect(() => changeCard('ASSIGN', uid, undefined, row.licenseNumber,
        [{ ...members[0], lifecycleStatus }], 'operator', now)).toThrowError(/actif/);
    }
    for (const action of ['LOST', 'RETIRED'] as const) {
      const unavailable = changeCard(action, uid, card, undefined, members, 'operator', now);
      expect(() => changeCard('ASSIGN', uid, unavailable, row.licenseNumber, members, 'operator', now)).toThrowError(/interdite/);
    }
  });

  it('prevalidates quantities, duplicate UIDs, names, licences and existing assignments', () => {
    expect(() => validateImport([row], 2, members, [])).toThrowError(/quantité/);
    expect(validateImport([row, row], 2, members, [])[1].outcome).toBe('ERROR');
    expect(validateImport([{ ...row, licenseNumber: 'unknown' }], 1, members, [])[0].outcome).toBe('ERROR');
    expect(validateImport([{ ...row, firstname: 'Wrong' }], 1, members, [])[0].outcome).toBe('ERROR');
    const card = changeCard('ASSIGN', uid, undefined, row.licenseNumber, members, 'operator', now);
    expect(validateImport([row], 1, members, [card])[0].outcome).toBe('SKIP');
    expect(validateImport([row], 1, members, [{ ...card, status: 'DISABLED' }])[0].outcome).toBe('ERROR');
  });

  it('tracks ordering with a minimum of ten and delivery without returning the white card', () => {
    const requested = changeRequest(undefined, row.licenseNumber, 'REQUESTED', members, now);
    expect(() => changeRequest(requested, row.licenseNumber, 'ORDERED', members, now, 'C-1', 9)).toThrowError(/10/);
    const ordered = changeRequest(requested, row.licenseNumber, 'ORDERED', members, now, 'C-1', 10);
    expect(() => changeRequest(ordered, row.licenseNumber, 'RECEIVED', members, now)).toThrowError(/définitive/);
    const card = changeCard('ASSIGN', uid, undefined, row.licenseNumber, members, 'operator', now);
    const received = changeRequest(ordered, row.licenseNumber, 'RECEIVED', members, now, undefined, undefined, card);
    expect(changeRequest(received, row.licenseNumber, 'DELIVERED', members, now, undefined, undefined, card).uid).toBe(uid);
    expect(() => changeRequest(requested, row.licenseNumber, 'DELIVERED', members, now)).toThrowError(/Transition/);
  });

  it('parses quoted CSVs without destroying leading zeros and refuses numeric spreadsheet identifiers', () => {
    const parsed = importRows(parseCsv('\uFEFFprenom;nom;licence;uid\r\n"Alex";"Exem;ple";"00123456";"04E50142E37384"\r\n'));
    expect(parsed[0].licenseNumber).toBe('00123456');
    expect(parsed[0].lastname).toBe('Exem;ple');
    expect(() => parseCsv('prenom;nom\n"unclosed')).toThrowError(/fermé/);
    expect(() => importRows([['prenom', 'nom', 'licence', 'uid'], ['Alex', 'Exemple', 123456, uid]])).toThrowError(/texte/);
    expect(csvReport([['=1+1']])).toContain("'=1+1");
  });
});
