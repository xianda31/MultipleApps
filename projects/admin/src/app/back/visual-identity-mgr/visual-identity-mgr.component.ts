import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { firstValueFrom, take } from 'rxjs';

import { CmsImageReview } from '../../common/images/cms-image-review/cms-image-review';
import {
  CmsImageProfile,
  cmsImageSourcePrefix,
  cmsImageVariantPath,
} from '../../common/images/cms-image-profiles';
import { UIConfiguration } from '../../common/interfaces/ui-conf.interface';
import { FileService } from '../../common/services/files.service';
import { ImgService } from '../../common/services/img.service';
import { SystemDataService } from '../../common/services/system-data.service';
import { ToastService } from '../../common/services/toast.service';

type IdentityAsset = 'banner' | 'logo';

interface PendingIdentityImage {
  kind: IdentityAsset;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
}

interface IdentityAssetInfo {
  path: string;
  url: string;
  size: number;
  width: number | null;
  height: number | null;
}

@Component({
  selector: 'app-visual-identity-mgr',
  standalone: true,
  imports: [CommonModule, CmsImageReview],
  templateUrl: './visual-identity-mgr.component.html',
  styleUrl: './visual-identity-mgr.component.scss',
})
export class VisualIdentityMgrComponent implements OnInit, OnDestroy {
  readonly desktopProfile: CmsImageProfile = 'club-banner-desktop';
  readonly mobileProfile: CmsImageProfile = 'club-banner-mobile';
  readonly mobileLandscapeProfile: CmsImageProfile = 'club-banner-mobile-landscape';
  readonly logoProfile: CmsImageProfile = 'club-logo';

  loading = true;
  uploading = false;
  pending: PendingIdentityImage | null = null;
  desktop: IdentityAssetInfo | null = null;
  mobile: IdentityAssetInfo | null = null;
  mobileLandscape: IdentityAssetInfo | null = null;
  logo: IdentityAssetInfo | null = null;
  private settings: UIConfiguration | null = null;

  constructor(
    private fileService: FileService,
    private imgService: ImgService,
    private systemDataService: SystemDataService,
    private toastService: ToastService,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      this.settings = await firstValueFrom(this.systemDataService.get_ui_settings().pipe(take(1)));
      await this.reloadCurrentAssets();
    } catch {
      this.toastService.showError('Identité visuelle', 'Impossible de charger les médias actuels.');
    } finally {
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    this.clearPending();
  }

  async selectFile(event: Event, kind: IdentityAsset): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const supportedType = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
    const supportedExtension = /\.(?:jpe?g|png|webp)$/i.test(file.name);
    if (!supportedType && !supportedExtension) {
      this.toastService.showWarning('Identité visuelle', 'Formats acceptés : JPEG, PNG et WebP.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      this.toastService.showWarning('Identité visuelle', 'La source ne doit pas dépasser 15 Mo.');
      return;
    }

    try {
      const dimensions = await this.imgService.imageDimensions(file);
      this.clearPending();
      this.pending = {
        kind,
        file,
        previewUrl: URL.createObjectURL(file),
        width: dimensions.width,
        height: dimensions.height,
      };
    } catch {
      this.toastService.showError('Identité visuelle', 'Impossible de lire cette image.');
    }
  }

  async prepareCurrent(kind: IdentityAsset): Promise<void> {
    const current = kind === 'banner' ? this.desktop : this.logo;
    if (!current || this.uploading) return;

    try {
      const blob = await this.fileService.download_file(current.path);
      const extension = current.path.split('.').pop()?.toLowerCase() || 'jpg';
      const file = new File([blob], `identite-actuelle.${extension}`, { type: blob.type });
      const dimensions = await this.imgService.imageDimensions(file);
      this.clearPending();
      this.pending = {
        kind,
        file,
        previewUrl: URL.createObjectURL(file),
        width: dimensions.width,
        height: dimensions.height,
      };
    } catch {
      this.toastService.showError('Identité visuelle', 'Impossible de récupérer le média actuel.');
    }
  }

  isOptimized(asset: IdentityAssetInfo | null, profile: CmsImageProfile): boolean {
    return !!asset?.path.includes(`/variants/${profile}/`);
  }

  clearPending(): void {
    if (this.pending?.previewUrl) URL.revokeObjectURL(this.pending.previewUrl);
    this.pending = null;
  }

  async uploadPending(): Promise<void> {
    if (!this.pending || !this.settings || this.uploading) return;
    this.uploading = true;

    try {
      if (this.pending.kind === 'banner') {
        const [desktopPath, mobilePath, mobileLandscapePath] = await Promise.all([
          this.uploadVariant(this.pending.file, this.desktopProfile),
          this.uploadVariant(this.pending.file, this.mobileProfile),
          this.uploadVariant(this.pending.file, this.mobileLandscapeProfile),
        ]);
        this.settings = {
          ...this.settings,
          template: {
            ...this.settings.template,
            club: {
              ...this.settings.template.club,
              image: desktopPath,
              imageMobile: mobilePath,
              imageMobileLandscape: mobileLandscapePath,
            },
          },
        };
      } else {
        const logoPath = await this.uploadVariant(this.pending.file, this.logoProfile);
        this.settings = {
          ...this.settings,
          template: {
            ...this.settings.template,
            club: { ...this.settings.template.club, logo: logoPath },
          },
        };
      }

      await this.systemDataService.save_ui_settings(this.settings);
      this.clearPending();
      await this.reloadCurrentAssets();
      this.toastService.showSuccess('Identité visuelle', 'Les variantes optimisées sont enregistrées.');
    } catch (error) {
      console.error('Visual identity processing failed', error);
      this.toastService.showError('Identité visuelle', 'Le traitement de l’image n’a pas abouti.');
    } finally {
      this.uploading = false;
    }
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    return bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} Ko`
      : `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  private async uploadVariant(source: File, profile: CmsImageProfile): Promise<string> {
    const extension = source.name.split('.').pop()?.toLowerCase() || 'jpg';
    const sourceFile = new File(
      [source],
      `${globalThis.crypto.randomUUID()}.${extension}`,
      { type: source.type, lastModified: source.lastModified },
    );
    const sourcePrefix = cmsImageSourcePrefix('visual-identity', profile);
    const sourcePath = `${sourcePrefix}${sourceFile.name}`;
    const variantPath = cmsImageVariantPath(sourcePath);
    await this.fileService.upload_file(sourceFile, sourcePrefix);
    await this.waitForVariant(variantPath);
    return variantPath;
  }

  private async waitForVariant(path: string): Promise<void> {
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        await firstValueFrom(this.fileService.getPresignedUrl$(path, true, true));
        return;
      } catch {
        if (attempt === 29) break;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    throw new Error(`Visual identity processing timed out: ${path}`);
  }

  private async reloadCurrentAssets(): Promise<void> {
    const club = this.settings?.template?.club;
    const [desktop, mobile, mobileLandscape, logo] = await Promise.all([
      this.loadAsset(club?.image),
      this.loadAsset(club?.imageMobile),
      this.loadAsset(club?.imageMobileLandscape),
      this.loadAsset(club?.logo),
    ]);
    this.desktop = desktop;
    this.mobile = mobile;
    this.mobileLandscape = mobileLandscape;
    this.logo = logo;
  }

  private async loadAsset(path?: string): Promise<IdentityAssetInfo | null> {
    if (!path) return null;
    try {
      const [url, blob] = await Promise.all([
        firstValueFrom(this.fileService.getPresignedUrl$(path)),
        this.fileService.download_file(path),
      ]);
      let dimensions: { width: number; height: number } | null = null;
      try {
        const file = new File([blob], 'identity-image', { type: blob.type });
        dimensions = await this.imgService.imageDimensions(file);
      } catch {
        dimensions = null;
      }
      return {
        path,
        url,
        size: blob.size,
        width: dimensions?.width ?? null,
        height: dimensions?.height ?? null,
      };
    } catch {
      return null;
    }
  }
}
