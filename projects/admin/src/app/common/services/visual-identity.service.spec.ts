import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, skip, take } from 'rxjs';

import { UIConfiguration } from '../interfaces/ui-conf.interface';
import { FileService } from './files.service';
import { VisualIdentityService } from './visual-identity.service';

describe('VisualIdentityService', () => {
  let service: VisualIdentityService;
  let getPresignedUrl: jasmine.Spy;

  beforeEach(() => {
    getPresignedUrl = jasmine.createSpy('getPresignedUrl$')
      .and.callFake((path: string) => of(`https://example.test/${path}`));
    TestBed.configureTestingModule({
      providers: [
        VisualIdentityService,
        { provide: FileService, useValue: { getPresignedUrl$: getPresignedUrl } },
      ],
    });
    service = TestBed.inject(VisualIdentityService);
  });

  it('resolves desktop, mobile and logo URLs once', async () => {
    const identityPromise = firstValueFrom(service.identity$.pipe(skip(1), take(1)));

    await service.load(settings('desktop.webp', 'mobile.webp', 'logo.webp', 'mobile-landscape.webp'));
    const identity = await identityPromise;

    expect(identity).toEqual({
      logo: 'https://example.test/logo.webp',
      bannerDesktop: 'https://example.test/desktop.webp',
      bannerMobile: 'https://example.test/mobile.webp',
      bannerMobileLandscape: 'https://example.test/mobile-landscape.webp',
    });
    expect(getPresignedUrl).toHaveBeenCalledTimes(4);
  });

  it('uses the desktop URL as the mobile fallback without resolving it twice', async () => {
    const identityPromise = firstValueFrom(service.identity$.pipe(skip(1), take(1)));

    await service.load(settings('legacy-banner.jpg', undefined, 'logo.jpg'));
    const identity = await identityPromise;

    expect(identity.bannerDesktop).toBe('https://example.test/legacy-banner.jpg');
    expect(identity.bannerMobile).toBe(identity.bannerDesktop);
    expect(identity.bannerMobileLandscape).toBe(identity.bannerDesktop);
    expect(getPresignedUrl).toHaveBeenCalledTimes(2);
  });

  function settings(
    image: string,
    imageMobile: string | undefined,
    logo: string,
    imageMobileLandscape?: string,
  ): UIConfiguration {
    return {
      template: {
        banner: { bg: '', text_color: '' },
        navbar: { bg: '', text_color: '' },
        content: { bg: '', text_color: '' },
        footer: { bg: '', text_color: '' },
        club: { name: '', font: '', image, imageMobile, imageMobileLandscape, logo },
      },
      homepage: {
        tournaments_row_cols: { SM: 1, MD: 1, LG: 1, XL: 1 },
        news_row_cols: { SM: 1, MD: 1, LG: 1, XL: 1 },
      },
      card_thumbnails: [],
      album_thumbnail: { width: 600, height: 400 },
      competitions: {
        preferred_organizations: { comite: '', ligue: '', national: '' },
        result_filter_thresholds: {},
        one_year_back: false,
        show_infos: false,
      },
    };
  }
});
