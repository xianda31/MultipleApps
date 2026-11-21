import { TestBed } from '@angular/core/testing';
import { FFB_proxyService } from '../../../common/ffb/services/ffb.service';
import { FfbRegularityResultsComponent } from './ffb-regularity-results.component';

describe('FfbRegularityResultsComponent', () => {
  let ffb: jasmine.SpyObj<FFB_proxyService>;

  beforeEach(() => {
    ffb = jasmine.createSpyObj<FFB_proxyService>('FFB_proxyService', [
      'getCurrentSeason', 'getClubRegularityResultsGroup',
    ]);
    TestBed.configureTestingModule({
      imports: [FfbRegularityResultsComponent],
      providers: [{ provide: FFB_proxyService, useValue: ffb }],
    });
  });

  it('opens the group for the current FFB season', async () => {
    ffb.getCurrentSeason.and.resolveTo({ id: 38, label: '2026/2027', startDate: '', endDate: '' });
    ffb.getClubRegularityResultsGroup.and.resolveTo(21334);
    const fixture = TestBed.createComponent(FfbRegularityResultsComponent);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(ffb.getClubRegularityResultsGroup).toHaveBeenCalledOnceWith(38);
    expect(fixture.nativeElement.querySelector('iframe').getAttribute('src'))
      .toBe('https://www.ffbridge.fr/competitions/results/groups/21334?season=38&page=1&itemsPerPage=50');
  });

  it('reports an error when the current season is unavailable', async () => {
    ffb.getCurrentSeason.and.resolveTo(null);
    spyOn(console, 'error');
    const fixture = TestBed.createComponent(FfbRegularityResultsComponent);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(ffb.getClubRegularityResultsGroup).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('iframe')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Impossible');
  });

  it('uses the available viewport height in mobile and laptop modes', async () => {
    ffb.getCurrentSeason.and.resolveTo({ id: 38, label: '2026/2027', startDate: '', endDate: '' });
    ffb.getClubRegularityResultsGroup.and.resolveTo(21334);
    const fixture = TestBed.createComponent(FfbRegularityResultsComponent);
    const shell = document.createElement('div');
    document.body.appendChild(shell);
    shell.appendChild(fixture.nativeElement);

    try {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const iframe: HTMLIFrameElement = fixture.nativeElement.querySelector('iframe');
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      expect(iframe.getBoundingClientRect().height)
        .toBeCloseTo(Math.max(320, window.innerHeight - 8 * rem), 0);

      shell.classList.add('laptop-main-shell');
      expect(iframe.getBoundingClientRect().height)
        .toBeCloseTo(Math.max(400, window.innerHeight - 8 * rem), 0);
    } finally {
      fixture.destroy();
      shell.remove();
    }
  });
});
