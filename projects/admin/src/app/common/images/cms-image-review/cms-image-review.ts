import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

import {
  CMS_IMAGE_PROFILES,
  CmsImageProfile,
  cmsImageFramingPercentages,
  cmsImageFramingProfiles,
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
  @Input() allowFramingChoice = false;
  @Output() profileChange = new EventEmitter<CmsImageProfile>();

  get definition() {
    return CMS_IMAGE_PROFILES[this.profile];
  }

  get targetDimensionsDescription(): string {
    if (this.definition.width === null || this.definition.aspectRatio === null) {
      return `Hauteur ${this.definition.height} px · largeur proportionnelle`;
    }
    const ratio = this.definition.aspectRatio.replace(/\s*\/\s*/, ':');
    return `${this.definition.width} × ${this.definition.height} px · ratio ${ratio}`;
  }

  get targetAspectRatio(): string | null {
    return this.definition.aspectRatio ?? this.sourceAspectRatio;
  }

  get framingProfiles() {
    return this.allowFramingChoice ? cmsImageFramingProfiles(this.profile) : null;
  }

  get hasSourceDimensions(): boolean {
    return !!this.sourceWidth && !!this.sourceHeight;
  }

  get sourceAspectRatio(): string | null {
    return this.hasSourceDimensions ? `${this.sourceWidth} / ${this.sourceHeight}` : null;
  }

  get orientationMismatch(): boolean {
    return this.definition.fit === 'cover' && this.hasSourceDimensions
      ? cmsImageOrientationMismatch(this.profile, this.sourceWidth!, this.sourceHeight!)
      : false;
  }

  get resolutionInsufficient(): boolean {
    if (!this.hasSourceDimensions) return false;

    const heightScale = this.definition.height / this.sourceHeight!;
    if (this.definition.width === null) return heightScale > 1;

    const widthScale = this.definition.width / this.sourceWidth!;
    const requiredScale = this.definition.fit === 'cover'
      ? Math.max(widthScale, heightScale)
      : Math.min(widthScale, heightScale);

    return requiredScale > 1;
  }

  get cropDescription(): string | null {
    if (!this.hasSourceDimensions) return null;

    const adjustment = cmsImageFramingPercentages(this.profile, this.sourceWidth!, this.sourceHeight!);
    const label = this.definition.transparentPadding ? 'Extension' : 'Rognage';
    return `${label} : L ${this.formatPercent(adjustment.width)} · H ${this.formatPercent(adjustment.height)}`;
  }

  framingDescription(profile: CmsImageProfile): string {
    if (!this.hasSourceDimensions) {
      return CMS_IMAGE_PROFILES[profile].transparentPadding ? 'Extension' : 'Rognage';
    }
    const adjustment = cmsImageFramingPercentages(profile, this.sourceWidth!, this.sourceHeight!);
    const label = CMS_IMAGE_PROFILES[profile].transparentPadding ? 'Extension' : 'Rognage';
    return `${label} : L ${this.formatPercent(adjustment.width)} · H ${this.formatPercent(adjustment.height)}`;
  }

  selectProfile(profile: CmsImageProfile): void {
    if (profile !== this.profile) this.profileChange.emit(profile);
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
