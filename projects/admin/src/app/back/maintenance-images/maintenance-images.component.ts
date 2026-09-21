import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { S3Item } from '../../common/interfaces/file.interface';
import { FileService } from '../../common/services/files.service';
import { ImgService } from '../../common/services/img.service';
import { ToastService } from '../../common/services/toast.service';

interface GalleryImage extends S3Item {
  name: string;
  previewUrl: string | null;
}

interface PreparedGalleryImage {
  original: File;
  source: File;
  variantPath: string;
  previewUrl: string;
  width: number;
  height: number;
}

@Component({
  selector: 'app-maintenance-images',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './maintenance-images.component.html',
  styleUrl: './maintenance-images.component.scss',
})
export class MaintenanceImagesComponent implements OnInit {
  readonly galleryPath = 'images/_ACCUEIL_/';
  readonly gallerySourcePath = 'images/home/sources/';

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  images: GalleryImage[] = [];
  preparedImages: PreparedGalleryImage[] = [];
  loading = false;
  preparing = false;
  uploading = false;
  deletingPath: string | null = null;
  loadError = false;

  constructor(
    private fileService: FileService,
    private imgService: ImgService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    void this.refresh();
  }

  get totalSize(): number {
    return this.images.reduce((total, image) => total + image.size, 0);
  }

  get oversizedImageCount(): number {
    return this.images.filter(image => image.size > 1024 * 1024).length;
  }

  get preparedOriginalSize(): number {
    return this.preparedImages.reduce((total, image) => total + image.original.size, 0);
  }

  async refresh(): Promise<void> {
    this.loading = true;
    this.loadError = false;

    try {
      const items = await firstValueFrom(this.fileService.list_files(this.galleryPath));
      const files = items.filter(item => this.isDirectGalleryImage(item));
      this.images = await Promise.all(files.map(async item => ({
        ...item,
        name: item.path.slice(this.galleryPath.length),
        previewUrl: await this.resolveUrl(item),
      })));
      this.images.sort((left, right) => left.name.localeCompare(right.name, 'fr'));
    } catch {
      this.images = [];
      this.loadError = true;
      this.toastService.showError('Galerie d’accueil', 'Impossible de charger les images.');
    } finally {
      this.loading = false;
    }
  }

  async onFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []).filter(file => file.type.startsWith('image/'));
    if (files.length === 0) return;

    this.clearPreparedImages();
    this.preparing = true;
    let failedCount = 0;

    for (const file of files) {
      try {
        const dimensions = await this.imgService.imageDimensions(file);
        const source = this.asImmutableGallerySource(file);
        const assetId = source.name.replace(/\.[^.]+$/, '');
        this.preparedImages.push({
          original: file,
          source,
          variantPath: `${this.galleryPath}${assetId}.webp`,
          previewUrl: URL.createObjectURL(file),
          width: dimensions.width,
          height: dimensions.height,
        });
      } catch {
        failedCount++;
      }
    }

    this.preparing = false;
    input.value = '';

    if (failedCount > 0) {
      this.toastService.showWarning('Préparation incomplète', `${failedCount} image(s) n’ont pas pu être préparée(s).`);
    }
  }

  async uploadPreparedImages(): Promise<void> {
    if (this.preparedImages.length === 0 || this.uploading) return;

    this.uploading = true;
    let failedCount = 0;

    for (const image of this.preparedImages) {
      try {
        await this.fileService.upload_file(image.source, this.gallerySourcePath);
        await this.waitForVariant(image.variantPath);
      } catch {
        failedCount++;
      }
    }

    this.uploading = false;
    const importedCount = this.preparedImages.length - failedCount;
    if (failedCount === 0) this.clearPreparedImages();
    await this.refresh();

    if (failedCount === 0) {
      this.toastService.showSuccess('Galerie d’accueil', `${importedCount} image(s) importée(s).`);
    } else if (importedCount > 0) {
      this.toastService.showWarning('Import incomplet', `${importedCount} image(s) importée(s), ${failedCount} en échec.`);
    } else {
      this.toastService.showError('Galerie d’accueil', 'Aucune image n’a pu être importée.');
    }
  }

  removePreparedImage(image: PreparedGalleryImage): void {
    URL.revokeObjectURL(image.previewUrl);
    this.preparedImages = this.preparedImages.filter(item => item !== image);
  }

  clearPreparedImages(): void {
    this.preparedImages.forEach(image => URL.revokeObjectURL(image.previewUrl));
    this.preparedImages = [];
  }

  async deleteImage(image: GalleryImage): Promise<void> {
    if (!confirm(`Supprimer « ${image.name} » de la galerie d’accueil ?`)) return;

    this.deletingPath = image.path;
    try {
      await this.fileService.delete_file(image.path);
      this.images = this.images.filter(item => item.path !== image.path);
      this.toastService.showSuccess('Galerie d’accueil', 'Image supprimée.');
    } catch {
      this.toastService.showError('Galerie d’accueil', 'Impossible de supprimer cette image.');
    } finally {
      this.deletingPath = null;
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  trackByPath(_index: number, image: GalleryImage): string {
    return image.path;
  }

  private isDirectGalleryImage(item: S3Item): boolean {
    const relativePath = item.path.slice(this.galleryPath.length);
    return item.size > 0
      && !relativePath.includes('/')
      && /\.(avif|gif|jpe?g|png|webp)$/i.test(relativePath);
  }

  private async resolveUrl(item: S3Item): Promise<string | null> {
    try {
      return await firstValueFrom(item.url$ ?? this.fileService.getPresignedUrl$(item.path));
    } catch {
      return null;
    }
  }

  private asImmutableGallerySource(file: File): File {
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    return new File(
      [file],
      `${globalThis.crypto.randomUUID()}.${extension}`,
      { type: file.type, lastModified: file.lastModified },
    );
  }

  private async waitForVariant(path: string): Promise<void> {
    const maxAttempts = 30;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await firstValueFrom(this.fileService.getPresignedUrl$(path, true, true));
        return;
      } catch {
        if (attempt === maxAttempts - 1) break;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    throw new Error('Le traitement Sharp de l’image n’a pas abouti dans le délai prévu');
  }
}