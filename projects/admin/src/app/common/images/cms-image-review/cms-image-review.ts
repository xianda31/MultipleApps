import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import {
  CMS_IMAGE_PROFILES,
  CmsImageProfile,
  cmsImageOrientationMismatch,
  cmsImageSourceOrientation,
} from '../cms-image-profiles';

@Component({
  selector: 'app-cms-image-review',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cms-image-review.html',
  styleUrl: './cms-image-review.scss',
})
export class CmsImageReview {
  @Input({ required: true }) profile!: CmsImageProfile;
  @Input({ required: true }) sourceUrl!: string;
  @Input() sourceWidth: number | null = null;
  @Input() sourceHeight: number | null = null;
  @Input() sourceSize: number | null = null;

  get definition() {
    return CMS_IMAGE_PROFILES[this.profile];
  }

  get targetDimensionsDescription(): string {
    const ratio = this.definition.aspectRatio.replace(/\s*\/\s*/, ':');
    return `${this.definition.width} × ${this.definition.height} px · ratio ${ratio}`;
  }

  get hasSourceDimensions(): boolean {
    return !!this.sourceWidth && !!this.sourceHeight;
  }

  get sourceAspectRatio(): string | null {
    return this.hasSourceDimensions ? `${this.sourceWidth} / ${this.sourceHeight}` : null;
  }

  get orientationMismatch(): boolean {
    return this.hasSourceDimensions
      ? cmsImageOrientationMismatch(this.profile, this.sourceWidth!, this.sourceHeight!)
      : false;
  }

  get resolutionInsufficient(): boolean {
    if (!this.hasSourceDimensions) return false;

    const widthScale = this.definition.width / this.sourceWidth!;
    const heightScale = this.definition.height / this.sourceHeight!;
    const requiredScale = this.definition.fit === 'cover'
      ? Math.max(widthScale, heightScale)
      : Math.min(widthScale, heightScale);

    return requiredScale > 1;
  }

  get cropDescription(): string | null {
    if (!this.hasSourceDimensions) return null;

    let widthCrop = 0;
    let heightCrop = 0;
    if (this.definition.fit === 'cover') {
      const sourceRatio = this.sourceWidth! / this.sourceHeight!;
      const targetRatio = this.definition.width / this.definition.height;

      if (sourceRatio > targetRatio) {
        widthCrop = (1 - targetRatio / sourceRatio) * 100;
      } else if (sourceRatio < targetRatio) {
        heightCrop = (1 - sourceRatio / targetRatio) * 100;
      }
    }

    return `Rognage : L ${this.formatPercent(widthCrop)} · H ${this.formatPercent(heightCrop)}`;
  }

  get sourceOrientationLabel(): string {
    if (!this.hasSourceDimensions) return 'orientation inconnue';
    const orientation = cmsImageSourceOrientation(this.sourceWidth!, this.sourceHeight!);
    return orientation === 'landscape' ? 'paysage' : orientation === 'portrait' ? 'portrait' : 'carrée';
  }

  formatFileSize(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  private formatPercent(value: number): string {
    const rounded = Math.round(value * 10) / 10;
    return `${rounded.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
  }
}
