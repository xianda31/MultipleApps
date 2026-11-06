import { TestBed } from '@angular/core/testing';
import { Amplify } from 'aws-amplify';
import { of } from 'rxjs';
import { SystemDataService } from '../../services/system-data.service';
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
        useValue: { get_configuration: () => of({ trace_mode: false }) },
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
});
