import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, take } from 'rxjs';

import { CmsImageReview } from '../../common/images/cms-image-review/cms-image-review';
import {
  CmsImageProfile,
  TOURNAMENT_THUMBNAIL_OWNER_ID,
  TOURNAMENT_THUMBNAIL_PROFILE,
  cmsImageSourcePrefix,
  cmsImageVariantPath,
} from '../../common/images/cms-image-profiles';
import { UIConfiguration } from '../../common/interfaces/ui-conf.interface';
import { FileService } from '../../common/services/files.service';
import { ImgService } from '../../common/services/img.service';
import { SystemDataService } from '../../common/services/system-data.service';
import { ToastService } from '../../common/services/toast.service';

interface PendingThumbnail {
  target: number | 'default';
  file: File;
  previewUrl: string;
  width: number;
  height: number;
}

@Component({
  selector: 'app-tournament-thumbnails-mgr',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CmsImageReview],
  templateUrl: './tournament-thumbnails-mgr.component.html',
  styleUrl: './tournament-thumbnails-mgr.component.scss',
})
export class TournamentThumbnailsMgrComponent implements OnInit, OnDestroy {
  @ViewChild('importReview') private importReview?: ElementRef<HTMLElement>;

  readonly thumbnailProfile: CmsImageProfile = TOURNAMENT_THUMBNAIL_PROFILE;
  readonly thumbnailSourcePrefix = cmsImageSourcePrefix(TOURNAMENT_THUMBNAIL_OWNER_ID, this.thumbnailProfile);
  readonly form: FormGroup;
  readonly previewMap: Record<string, string | null> = {};

  loading = true;
  saving = false;
  uploading = false;
  pendingThumbnail: PendingThumbnail | null = null;
  private settings: UIConfiguration | null = null;

  constructor(
    private fb: FormBuilder,
    private fileService: FileService,
    private imgService: ImgService,
    private systemDataService: SystemDataService,
    private toastService: ToastService,
  ) {
    this.form = this.fb.group({
      mappings: this.fb.array([]),
      defaultImage: [''],
    });
  }

  get mappings(): FormArray {
    return this.form.get('mappings') as FormArray;
  }

  async ngOnInit(): Promise<void> {
    try {
      this.settings = await firstValueFrom(this.systemDataService.get_ui_settings().pipe(take(1)));
      const mappings = this.settings.tournaments_type ?? {};
      Object.entries(mappings)
        .filter(([key]) => key !== 'defaut')
        .forEach(([key, image]) => this.addMapping(key, image));

      const defaultImage = this.settings.default_tournament_image || mappings['defaut'] || '';
      this.form.get('defaultImage')?.setValue(defaultImage);
      await this.loadPreview('defaut', defaultImage);
    } catch {
      this.toastService.showError('Vignettes tournois', 'Impossible de charger la configuration.');
    } finally {
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    this.clearPendingThumbnail();
  }

  addMapping(key = '', image = ''): void {
    const group = this.fb.group({
      key: [key, Validators.required],
      image: [image],
    });
    this.mappings.push(group);
    void this.loadPreview(key, image);

    let previousKey = key;
    group.get('key')?.valueChanges.subscribe(value => {
      const nextKey = value?.trim() || '';
      if (previousKey && previousKey !== nextKey) delete this.previewMap[previousKey];
      previousKey = nextKey;
      void this.loadPreview(nextKey, group.get('image')?.value || '');
    });
    group.get('image')?.valueChanges.subscribe(value => {
      void this.loadPreview(group.get('key')?.value?.trim() || '', value || '');
    });
  }

  removeMapping(index: number): void {
    const key = this.mappings.at(index).get('key')?.value?.trim();
    if (key) delete this.previewMap[key];
    this.mappings.removeAt(index);
  }

  async onFileSelected(event: Event, target: number | 'default'): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.toastService.showWarning('Vignette tournoi', 'Le fichier sélectionné doit être une image.');
      return;
    }

    try {
      const dimensions = await this.imgService.imageDimensions(file);
      this.clearPendingThumbnail();
      this.pendingThumbnail = {
        target,
        file,
        previewUrl: URL.createObjectURL(file),
        width: dimensions.width,
        height: dimensions.height,
      };
      requestAnimationFrame(() => {
        this.importReview?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } catch {
      this.toastService.showError('Vignette tournoi', 'Impossible de lire cette image.');
    }
  }

  async uploadPendingThumbnail(): Promise<void> {
    const pending = this.pendingThumbnail;
    if (!pending || this.uploading) return;

    this.uploading = true;
    try {
      const extension = pending.file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const sourceFile = new File(
        [pending.file],
        `${globalThis.crypto.randomUUID()}.${extension}`,
        { type: pending.file.type, lastModified: pending.file.lastModified },
      );
      const sourcePath = `${this.thumbnailSourcePrefix}${sourceFile.name}`;
      const variantPath = cmsImageVariantPath(sourcePath);

      await this.fileService.upload_file(sourceFile, this.thumbnailSourcePrefix);
      await this.waitForVariant(variantPath);

      if (pending.target === 'default') {
        this.form.get('defaultImage')?.setValue(variantPath);
        await this.loadPreview('defaut', variantPath);
      } else {
        const mapping = this.mappings.at(pending.target);
        mapping.get('image')?.setValue(variantPath);
      }
      this.form.markAsDirty();
      const saved = await this.save('Image traitée, associée et enregistrée.');
      if (saved) this.clearPendingThumbnail();
    } catch {
      this.toastService.showError('Vignette tournoi', 'Le traitement de l’image a échoué ou expiré.');
    } finally {
      this.uploading = false;
    }
  }

  clearPendingThumbnail(): void {
    if (this.pendingThumbnail) URL.revokeObjectURL(this.pendingThumbnail.previewUrl);
    this.pendingThumbnail = null;
  }

  async saveKeywordChange(index: number): Promise<void> {
    const image = this.mappings.at(index).get('image')?.value;
    if (image) await this.save();
  }

  async save(successMessage = 'Configuration enregistrée.'): Promise<boolean> {
    if (!this.settings || this.form.invalid || this.hasDuplicateKeys() || this.saving) {
      this.form.markAllAsTouched();
      return false;
    }

    this.saving = true;
    try {
      const tournamentTypes: Record<string, string> = {};
      this.mappings.getRawValue().forEach((entry: { key: string; image: string }) => {
        tournamentTypes[entry.key.trim()] = entry.image || '';
      });
      const defaultImage = this.form.get('defaultImage')?.value || '';
      if (defaultImage) tournamentTypes['defaut'] = defaultImage;

      this.settings = {
        ...this.settings,
        tournaments_type: tournamentTypes,
        default_tournament_image: defaultImage,
      };
      await this.systemDataService.save_ui_settings(this.settings);
      this.form.markAsPristine();
      this.toastService.showSuccess('Vignettes tournois', successMessage);
      return true;
    } catch {
      this.toastService.showError('Vignettes tournois', 'Impossible d’enregistrer la configuration.');
      return false;
    } finally {
      this.saving = false;
    }
  }

  hasDuplicateKeys(): boolean {
    const keys = this.mappings.controls
      .map(control => control.get('key')?.value?.trim())
      .filter((key): key is string => !!key);
    return new Set(keys).size !== keys.length;
  }

  private async loadPreview(key: string, image: string): Promise<void> {
    if (!key) return;
    if (!image) {
      this.previewMap[key] = null;
      return;
    }

    try {
      this.previewMap[key] = await firstValueFrom(this.fileService.getPresignedUrl$(image));
    } catch {
      this.previewMap[key] = null;
    }
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
    throw new Error(`Tournament thumbnail processing timed out: ${path}`);
  }
}
