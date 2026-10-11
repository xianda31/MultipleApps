import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';

import { UIConfiguration } from '../interfaces/ui-conf.interface';
import { FileService } from './files.service';

export interface VisualIdentityUrls {
  logo: string | null;
  bannerDesktop: string | null;
  bannerMobile: string | null;
  bannerMobileLandscape: string | null;
}

@Injectable({ providedIn: 'root' })
export class VisualIdentityService {
  private readonly identitySubject = new BehaviorSubject<VisualIdentityUrls>({
    logo: null,
    bannerDesktop: null,
    bannerMobile: null,
    bannerMobileLandscape: null,
  });
  readonly identity$ = this.identitySubject.asObservable();

  private loadedPaths = '';
  private loadSequence = 0;

  constructor(private fileService: FileService) {}

  async load(settings: UIConfiguration): Promise<void> {
    const club = settings?.template?.club;
    const desktopPath = club?.image || '';
    const mobilePath = club?.imageMobile || desktopPath;
    const mobileLandscapePath = club?.imageMobileLandscape || desktopPath;
    const logoPath = club?.logo || '';
    const paths = `${logoPath}|${desktopPath}|${mobilePath}|${mobileLandscapePath}`;
    if (paths === this.loadedPaths) return;

    this.loadedPaths = paths;
    const sequence = ++this.loadSequence;
    const desktopPromise = this.resolveUrl(desktopPath);
    const mobilePromise = mobilePath === desktopPath ? desktopPromise : this.resolveUrl(mobilePath);
    const mobileLandscapePromise = mobileLandscapePath === desktopPath
      ? desktopPromise
      : mobileLandscapePath === mobilePath
        ? mobilePromise
        : this.resolveUrl(mobileLandscapePath);
    const [logo, bannerDesktop, bannerMobile, bannerMobileLandscape] = await Promise.all([
      this.resolveUrl(logoPath),
      desktopPromise,
      mobilePromise,
      mobileLandscapePromise,
    ]);
    if (sequence !== this.loadSequence) return;

    const identity = { logo, bannerDesktop, bannerMobile, bannerMobileLandscape };
    this.identitySubject.next(identity);
    this.preloadBanner(identity);
  }

  private async resolveUrl(path: string): Promise<string | null> {
    if (!path) return null;
    try {
      return await firstValueFrom(this.fileService.getPresignedUrl$(path, true));
    } catch {
      return null;
    }
  }

  private preloadBanner(identity: VisualIdentityUrls): void {
    const isMobilePortrait = typeof globalThis.matchMedia === 'function'
      && globalThis.matchMedia('(max-width: 767.98px)').matches;
    const isMobileLandscape = typeof globalThis.matchMedia === 'function'
      && globalThis.matchMedia('(max-height: 500px) and (orientation: landscape)').matches;
    const url = isMobileLandscape
      ? identity.bannerMobileLandscape
      : isMobilePortrait ? identity.bannerMobile
      : identity.bannerDesktop;
    if (!url) return;

    const image = new Image();
    image.decoding = 'async';
    image.fetchPriority = 'high';
    image.src = url;
  }
}
