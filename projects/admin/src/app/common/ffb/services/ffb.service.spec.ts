import { TestBed } from '@angular/core/testing';
import { Amplify } from 'aws-amplify';
import { of } from 'rxjs';
import { SystemDataService } from '../../services/system-data.service';
import { SystemConfiguration } from '../../interfaces/system-conf.interface';
import { FFB_proxyService } from './ffb.service';

describe('FFB team registration requests', () => {
  const originalConfig = Amplify.getConfig();
  let service: FFB_proxyService;
  let fetchSpy: jasmine.Spy<typeof fetch>;

  beforeEach(() => {
    Amplify.configure({
      API: {
        REST: {
          ffbProxyApi: { endpoint: 'https://ffb.example.test', region: 'eu-west-3' },
        },
      },
    });
    TestBed.configureTestingModule({
      providers: [{
        provide: SystemDataService,
        useValue: { get_configuration: () => of({ trace_mode: false, ffb_club_code: '5500020', ffb_organization_id: '1403' }) },
      }],
    });
    service = TestBed.inject(FFB_proxyService);
    fetchSpy = spyOn(window, 'fetch');
  });

  afterEach(() => {
    Amplify.configure(originalConfig);
  });

  it('sends only one POST on HTTP 500 and propagates the FFB error without logging again', async () => {
    const reason = 'Les inscriptions sont gérées par l’entité organisatrice.';
    fetchSpy.and.callFake(async () => new Response(JSON.stringify({ message: reason }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }));
    spyOn(console, 'error');

    await expectAsync(service.postTeam('516676', [83243, 259431])).toBeRejected();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.calls.mostRecent().args[1]?.method).toBe('POST');
    expect(console.error).not.toHaveBeenCalled();
  });

  it('preserves successful team creation', async () => {
    fetchSpy.and.callFake(async () => new Response('{}', { status: 200 }));

    await expectAsync(service.postTeam('516676', [83243, 259431])).toBeResolvedTo(true);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('finds the regularity group by label, regardless of other groups', async () => {
    fetchSpy.and.resolveTo(new Response(JSON.stringify({
      items: [{
        organization: { id: 1403, ffbCode: '5500020' },
        phases: [{ groups: [{ id: 8, label: 'Tournoi de club' }, { id: 21334, label: 'A' }] }],
      }],
      pagination: { has_next_page: false },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expectAsync(service.getClubRegularityResultsGroup(38)).toBeResolvedTo(21334);
    expect(String(fetchSpy.calls.mostRecent().args[0])).toContain('/api/ffb/v2/club-results?season=38');
  });

  it('rejects ambiguous groups and results from another club', async () => {
    const response = (code: string, groups: object[]) => new Response(JSON.stringify({
      items: [{ organization: { id: 1403, ffbCode: code }, phases: [{ groups }] }],
      pagination: { has_next_page: false },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    fetchSpy.and.resolveTo(response('5500020', [{ id: 1, label: 'A' }, { id: 2, label: 'A' }]));
    await expectAsync(service.getClubRegularityResultsGroup(38)).toBeRejected();

    fetchSpy.and.resolveTo(response('5500055', [{ id: 1, label: 'A' }]));
    await expectAsync(service.getClubRegularityResultsGroup(38)).toBeRejected();
  });

  it('rejects incomplete or empty results rather than using an old group', async () => {
    fetchSpy.and.resolveTo(new Response(JSON.stringify({
      items: [], pagination: { has_next_page: true },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await expectAsync(service.getClubRegularityResultsGroup(38)).toBeRejected();

    fetchSpy.and.resolveTo(new Response(JSON.stringify({
      items: [], pagination: { has_next_page: false },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await expectAsync(service.getClubRegularityResultsGroup(38)).toBeRejected();
  });

  it('uses the configured identity instead of Saint-Orens when checking the results', async () => {
    const configuration: SystemConfiguration = {
      club_identifier: '', trace_mode: false, club_bank_key: '',
      ffb_club_code: '5500055', ffb_organization_id: '1438',
      online_payment_active: false, tpe_payment_active: false, CB_fees_account: '', minimum_cb_amount: 0,
      fee_rates: [], profit_and_loss: { debit_key: '', credit_key: '' },
      revenue_and_expense_tree: { sections: [], revenues: [], expenses: [] }, banks: [],
    };
    spyOn(TestBed.inject(SystemDataService), 'get_configuration').and.returnValue(of(configuration));
    fetchSpy.and.resolveTo(new Response(JSON.stringify({
      items: [{
        organization: { id: 1438, ffbCode: '5500055' },
        phases: [{ groups: [{ id: 12345, label: 'A' }] }],
      }],
      pagination: { has_next_page: false },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expectAsync(service.getClubRegularityResultsGroup(38)).toBeResolvedTo(12345);
  });

  it('returns a page of selectable clubs with validated identifiers', async () => {
    fetchSpy.and.resolveTo(new Response(JSON.stringify({
      items: [{ type: 'club', id: 1403, ffbCode: '5500020', label: 'Bridge Club de Saint Orens' }],
      pagination: { has_next_page: true },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expectAsync(service.searchClubs('Saint', 2)).toBeResolvedTo({
      clubs: [{ name: 'Bridge Club de Saint Orens', code: '5500020', organizationId: '1403' }],
      hasNextPage: true,
    });
    expect(String(fetchSpy.calls.mostRecent().args[0])).toContain('/api/ffb/v2/clubs/search?');
    expect(String(fetchSpy.calls.mostRecent().args[0])).toContain('currentPage=2');
  });

  it('rejects invalid clubs or incomplete pagination instead of displaying them', async () => {
    fetchSpy.and.resolveTo(new Response(JSON.stringify({
      items: [{ type: 'club', id: 0, ffbCode: '5500020', label: 'Club' }],
      pagination: { has_next_page: false },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await expectAsync(service.searchClubs('Club', 1)).toBeRejected();

    fetchSpy.and.resolveTo(new Response(JSON.stringify({ items: [], pagination: {} }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
    await expectAsync(service.searchClubs('Club', 1)).toBeRejected();
  });

  it('returns the official label when validating the club identity', async () => {
    fetchSpy.and.resolveTo(new Response(JSON.stringify({
      id: 1403, ffbCode: '5500020', type: 'club', label: 'Bridge Club de Saint Orens',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await expectAsync(service.validateClubIdentity('5500020', '1403')).toBeResolvedTo('Bridge Club de Saint Orens');
  });
});
