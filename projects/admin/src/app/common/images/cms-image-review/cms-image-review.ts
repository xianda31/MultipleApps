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

  get hasSourceDimensions(): boolean {
    return !!this.sourceWidth && !!this.sourceHeight;
  }

  get orientationMismatch(): boolean {
    return this.hasSourceDimensions
      ? cmsImageOrientationMismatch(this.profile, this.sourceWidth!, this.sourceHeight!)
      : false;
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
}
