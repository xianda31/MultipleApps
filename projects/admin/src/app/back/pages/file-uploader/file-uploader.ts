import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import { FileManager, FileUploadProgress } from '../../../services/file-manager';
import { FileService, S3_ROOT_FOLDERS } from '../../../common/services/files.service';
import { FileBrowser } from '../file-browser/file-browser';
import { CMS_IMAGE_PROFILES, CmsImageProfile, cmsImageTargetDescription, cmsImageVariantPath } from '../../../common/images/cms-image-profiles';
import { CmsImageReview } from '../../../common/images/cms-image-review/cms-image-review';
import { replaceImageExtensionWithWebp } from '../../../common/images/album-thumbnail-path';

@Component({
  selector: 'app-file-uploader',
  standalone: true,
  imports: [CommonModule, FormsModule, FileBrowser, CmsImageReview],
  templateUrl: './file-uploader.html',
  styleUrl: './file-uploader.scss'
})
export class FileUploader implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @Input() targetPathOverride: string | null = null;
  @Input() rootOverride: string | null = null;
  @Input() imageProfile: CmsImageProfile | null = null;
  @Input() hideTargetBrowser = false;
  @Output() uploaded = new EventEmitter<string[]>();

  selectedFiles: File[] = [];
  isUploading = false;
  uploadStatus = '';
  uploadStatusClass = '';
  uploadStatusIcon = '';
  currentRoot: string = S3_ROOT_FOLDERS.IMAGES;
  targetPath: string = '';
  cmsSourceWidth: number | null = null;
  cmsSourceHeight: number | null = null;
  
  // Cache for file thumbnails and selections
  private fileThumbnails = new Map<File, string>();
  private selectedOriginals = new Set<File>();
  private selectedThumbnails = new Set<File>();
  private fileToThumbnail = new Map<File, File>();

  private destroy$ = new Subject<void>();

  constructor(
    public fileManager: FileManager,
    private fileService: FileService,
    private cdr: ChangeDetectorRef
  ) {}

  get hasSelectedFiles(): boolean {
    return this.selectedOriginals.size > 0 || this.selectedThumbnails.size > 0;
  }

  get isAlbumMode(): boolean {
    return this.currentRoot.replace(/\/$/, '') === S3_ROOT_FOLDERS.ALBUMS;
  }

  get albumThumbnailsReady(): boolean {
    const images = this.selectedFiles.filter(file => this.isImageFile(file));
    return images.length > 0 && images.every(file => this.fileToThumbnail.has(file));
  }

  get albumOriginalSize(): number {
    return this.selectedFiles.reduce((total, file) => total + file.size, 0);
  }

  get albumThumbnailSize(): number {
    return Array.from(this.selectedThumbnails).reduce((total, file) => total + file.size, 0);
  }

  get albumThumbnailCount(): number {
    return this.selectedThumbnails.size;
  }

  get imageProfileDefinition() {
    return this.imageProfile ? CMS_IMAGE_PROFILES[this.imageProfile] : null;
  }

  get imageProfileTargetDescription(): string {
    return this.imageProfile ? cmsImageTargetDescription(this.imageProfile) : '';
  }

  get uploadProgress$() {
    return this.fileManager.uploadProgress$;
  }

  ngOnInit(): void {
    // Set initial root
    if (this.rootOverride) this.currentRoot = this.rootOverride;
    this.fileManager.setCurrentRoot(this.currentRoot);
    
    // Subscribe to file manager state changes for target selection
    this.fileManager.currentRoot$
      .pipe(takeUntil(this.destroy$))
      .subscribe(root => {
        this.currentRoot = root;
      });
        
    this.fileManager.currentPath$
      .pipe(takeUntil(this.destroy$))
      .subscribe(path => {
        this.targetPath = path;
      });
    
    // Subscribe to upload progress to detect completion
    this.fileManager.uploadProgress$
      .pipe(takeUntil(this.destroy$))
      .subscribe((progressItems: FileUploadProgress[]) => {
        if (progressItems.length > 0) {
          const allCompleted = progressItems.every(item => item.status === 'completed');
          const hasErrors = progressItems.some(item => item.status === 'error');
          
          if (allCompleted && !this.isUploading) {
            // Upload completed
            this.uploadStatus = 'Files uploaded successfully!';
            this.uploadStatusClass = 'alert-success';
            this.uploadStatusIcon = 'fa-check-circle';
            this.clearFiles();
            
            setTimeout(() => { this.uploadStatus = ''; }, 3000);
          } else if (hasErrors) {
            this.isUploading = false;
            this.uploadStatus = 'Some files failed to upload. Please try again.';
            this.uploadStatusClass = 'alert-danger';
            this.uploadStatusIcon = 'fa-exclamation-triangle';
            
            setTimeout(() => { this.uploadStatus = ''; }, 3000);
          }
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.selectedFiles = Array.from(input.files);
      // Clear previous selections
      this.selectedOriginals.clear();
      this.selectedThumbnails.clear();
      this.fileToThumbnail.clear();
      this.cmsSourceWidth = null;
      this.cmsSourceHeight = null;
      // Mark all files as candidates for upload by default
      this.selectedFiles.forEach(file => this.selectedOriginals.add(file));
      // Generate thumbnails for image files
      this.generateThumbnailsAndFiles();
    }
  }

  async uploadFiles(): Promise<void> {
    if (!this.hasSelectedFiles) return;

    this.isUploading = true;
    this.uploadStatus = '';
    
    try {
      if (this.imageProfile) {
        await this.uploadCmsImages();
        return;
      }

      const uploads: Promise<void>[] = [];
      
      // Upload selected original files
      if (this.selectedOriginals.size > 0) {
        const targetPath = this.getFullTargetPath();
        console.log('FileUploader: Uploading originals to path:', targetPath);
        const originalFiles = Array.from(this.selectedOriginals);
        
        // Add files to manager and upload
        this.fileManager.addFilesToUpload(targetPath, originalFiles);
        uploads.push(this.fileManager.uploadFiles(targetPath));
      }
      console.log('FileUploader: Current root is', this.currentRoot);
      // Special handling for ALBUMS: upload thumbnails to THUMBNAILS/albums
      if (this.isAlbumMode && this.selectedThumbnails.size > 0) {
        const thumbnailPath = this.getAlbumThumbnailPath();
        console.log('FileUploader: Uploading thumbnails to path:', thumbnailPath);
        const thumbnailFiles = Array.from(this.selectedThumbnails);
        
        // Add thumbnail files to manager and upload
        this.fileManager.addFilesToUpload(thumbnailPath, thumbnailFiles);
        uploads.push(this.fileManager.uploadFiles(thumbnailPath));

      } else if (this.selectedThumbnails.size > 0) {
        // For other roots (like IMAGES), upload selected thumbnails to same target
        const targetPath = this.getFullTargetPath();
        console.log('FileUploader: Uploading thumbnails to same path:', targetPath);
        const thumbnailFiles = Array.from(this.selectedThumbnails);
        
        // Add thumbnail files to manager and upload
        this.fileManager.addFilesToUpload(targetPath, thumbnailFiles);
        uploads.push(this.fileManager.uploadFiles(targetPath));
      }

      const preferredFiles = this.currentRoot.replace(/\/$/, '') === S3_ROOT_FOLDERS.IMAGES && this.selectedThumbnails.size > 0
        ? Array.from(this.selectedThumbnails)
        : Array.from(this.selectedOriginals);
      const uploadedPaths = preferredFiles.map(file => `${this.getFullTargetPath()}${file.name}`);
      await Promise.all(uploads);
      this.isUploading = false;
      this.uploaded.emit(uploadedPaths);
    } catch (error) {
      this.isUploading = false;
      this.uploadStatus = 'Upload failed: ' + (error as Error).message;
      this.uploadStatusClass = 'alert-danger';
      this.uploadStatusIcon = 'fa-exclamation-triangle';
      
      setTimeout(() => { this.uploadStatus = ''; }, 3000);
    }
  }

  private async uploadCmsImages(): Promise<void> {
    const originals = Array.from(this.selectedOriginals).filter(file => this.isImageFile(file));
    if (originals.length === 0) throw new Error('Aucune image valide à importer');

    const sourceFiles = originals.map(file => this.asImmutableCmsSource(file));
    const sourcePath = this.getFullTargetPath();
    this.fileManager.addFilesToUpload(sourcePath, sourceFiles);
    await this.fileManager.uploadFiles(sourcePath);

    this.uploadStatus = 'Optimisation de l’illustration...';
    this.uploadStatusClass = 'alert-info';
    this.uploadStatusIcon = 'fa-spinner fa-spin';

    const variantPaths = sourceFiles.map(file => cmsImageVariantPath(`${sourcePath}${file.name}`));
    await Promise.all(variantPaths.map(path => this.waitForVariant(path)));

    this.isUploading = false;
    this.uploadStatus = 'Illustration optimisée avec succès';
    this.uploadStatusClass = 'alert-success';
    this.uploadStatusIcon = 'fa-check-circle';
    this.clearFiles();
    this.uploaded.emit(variantPaths);
    setTimeout(() => { this.uploadStatus = ''; }, 3000);
  }

  private asImmutableCmsSource(file: File): File {
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const assetId = globalThis.crypto.randomUUID();
    return new File([file], `${assetId}.${extension}`, { type: file.type, lastModified: file.lastModified });
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
    throw new Error('Le traitement de l’image n’a pas abouti dans le délai prévu');
  }

  removeFile(fileToRemove: File): void {
    this.selectedFiles = this.selectedFiles.filter(file => file !== fileToRemove);
    // Remove from selections and thumbnails
    this.selectedOriginals.delete(fileToRemove);
    this.selectedThumbnails.delete(fileToRemove);
    this.fileThumbnails.delete(fileToRemove);
    
    // Remove thumbnail file if exists
    const thumbnailFile = this.fileToThumbnail.get(fileToRemove);
    if (thumbnailFile) {
      this.selectedThumbnails.delete(thumbnailFile);
      this.fileThumbnails.delete(thumbnailFile);
      this.fileToThumbnail.delete(fileToRemove);
    }
  }

  // Selection methods
  toggleOriginalSelection(file: File): void {
    if (this.selectedOriginals.has(file)) {
      this.selectedOriginals.delete(file);
    } else {
      this.selectedOriginals.add(file);
    }
  }

  toggleThumbnailSelection(file: File): void {
    if (this.selectedThumbnails.has(file)) {
      this.selectedThumbnails.delete(file);
    } else {
      this.selectedThumbnails.add(file);
    }
  }

  isOriginalSelected(file: File): boolean {
    return this.selectedOriginals.has(file);
  }

  isThumbnailSelected(file: File): boolean {
    return this.selectedThumbnails.has(file);
  }

  getThumbnailFile(originalFile: File): File | undefined {
    return this.fileToThumbnail.get(originalFile);
  }

  getGeneratedThumbnailPreview(originalFile: File): string | null {
    const thumbnailFile = this.getThumbnailFile(originalFile);
    return thumbnailFile ? this.getFileThumbnail(thumbnailFile) : null;
  }

  clearFiles(): void {
    this.selectedFiles = [];
    this.selectedOriginals.clear();
    this.selectedThumbnails.clear();
    this.fileToThumbnail.clear();
    this.cmsSourceWidth = null;
    this.cmsSourceHeight = null;
    this.clearThumbnails();
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  setRoot(root: string): void {
    this.currentRoot = root;
    this.fileManager.setCurrentRoot(root);
  }

  onRootChange(newRoot: string): void {
    this.currentRoot = newRoot;
    this.fileManager.setCurrentRoot(newRoot);
  }

  getTargetPath(): string {
    const root = this.currentRoot.endsWith('/') ? this.currentRoot : this.currentRoot + '/';
    const path = this.targetPath ? this.targetPath + '/' : '';
    return root + path;
  }

  getFullTargetPath(): string {
    if (this.targetPathOverride) {
      return this.targetPathOverride.endsWith('/') ? this.targetPathOverride : `${this.targetPathOverride}/`;
    }

    // Build the complete S3 path for upload
    let fullPath = this.currentRoot;
    
    // Ensure root ends with /
    if (!fullPath.endsWith('/')) {
      fullPath += '/';
    }
    
    // Add target path if selected
    if (this.targetPath) {
      fullPath += this.targetPath;
      if (!fullPath.endsWith('/')) {
        fullPath += '/';
      }
    }
    return fullPath;
  }

  getAlbumThumbnailPath(): string {
    const albumPath = this.getFullTargetPath();
    const relativePath = albumPath.replace(/^albums\//, '');
    return `${S3_ROOT_FOLDERS.THUMBNAILS}/albums/${relativePath}`;
  }

  trackByFile(index: number, file: File): string {
    return file.name + file.size + file.lastModified;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Thumbnail and file type methods
  isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
  }

  getFileThumbnail(file: File): string | null {
    return this.fileThumbnails.get(file) || null;
  }

  getFileIcon(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    
    switch (extension) {
      case 'pdf':
        return 'bi bi-file-earmark-pdf text-danger';
      case 'doc':
      case 'docx':
        return 'bi bi-file-earmark-word text-primary';
      case 'xls':
      case 'xlsx':
        return 'bi bi-file-earmark-excel text-success';
      case 'ppt':
      case 'pptx':
        return 'bi bi-file-earmark-ppt text-warning';
      case 'txt':
        return 'bi bi-file-earmark-text';
      case 'zip':
      case 'rar':
      case '7z':
        return 'bi bi-file-earmark-zip';
      case 'mp4':
      case 'avi':
      case 'mov':
        return 'bi bi-file-earmark-play text-info';
      case 'mp3':
      case 'wav':
      case 'flac':
        return 'bi bi-file-earmark-music text-purple';
      default:
        return 'bi bi-file-earmark';
    }
  }

  private generateThumbnailsAndFiles(): void {
    this.selectedFiles.forEach(file => {
      if (this.isImageFile(file)) {
        // Generate display thumbnail
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          if (result) {
            this.fileThumbnails.set(file, result);
            if (this.imageProfile) {
              this.readCmsSourceDimensions(result);
            } else {
              this.createThumbnailFile(file, result);
            }
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  private createThumbnailFile(originalFile: File, dataUrl: string): void {
    // Create a canvas to resize the image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Set thumbnail dimensions (max 200px)
      const maxSize = 200;
      let { width, height } = img;
      
      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            // Create thumbnail filename
            const fileNameParts = originalFile.name.split('.');
            const extension = fileNameParts.pop();
            const baseName = fileNameParts.join('.') || originalFile.name;
            
            // Si ALBUMS: nom identique (sans suffixe), sinon: suffixe avec dimensions
            let thumbnailName: string;
            if (this.isAlbumMode) {
              thumbnailName = replaceImageExtensionWithWebp(originalFile.name);
            } else {
              const ratio = (width / height).toFixed(2);
              thumbnailName = `${baseName}_${Math.round(width)}x${Math.round(height)}_${ratio}.${extension}`;
            }
            
            const thumbnailFile = new File([blob], thumbnailName, {
              type: this.isAlbumMode ? 'image/webp' : originalFile.type
            });
            
            // Store the relationship and thumbnail preview
            this.fileToThumbnail.set(originalFile, thumbnailFile);
            // Mark thumbnail as candidate for upload by default
            this.selectedThumbnails.add(thumbnailFile);
            
            // Create thumbnail preview
            const thumbnailReader = new FileReader();
            thumbnailReader.onload = (e) => {
              const thumbnailResult = e.target?.result as string;
              if (thumbnailResult) {
                this.fileThumbnails.set(thumbnailFile, thumbnailResult);
                // Force change detection to update the view
                this.cdr.detectChanges();
              }
            };
            thumbnailReader.readAsDataURL(thumbnailFile);
          }
        }, this.isAlbumMode ? 'image/webp' : originalFile.type, this.isAlbumMode ? 0.82 : 0.8);
      }
    };
    
    img.src = dataUrl;
  }

  private readCmsSourceDimensions(dataUrl: string): void {
    const image = new Image();
    image.onload = () => {
      this.cmsSourceWidth = image.naturalWidth;
      this.cmsSourceHeight = image.naturalHeight;
      this.cdr.detectChanges();
    };
    image.src = dataUrl;
  }

  private clearThumbnails(): void {
    this.fileThumbnails.clear();
  }

  // Helper to get root folder options
  get rootFolders() {
    return S3_ROOT_FOLDERS;
  }
}
