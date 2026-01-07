import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { FileManager, FileUploadProgress } from '../../../services/file-manager';
import { S3_ROOT_FOLDERS } from '../../../common/services/files.service';
import { FileBrowser } from '../file-browser/file-browser';

@Component({
  selector: 'app-file-uploader',
  standalone: true,
  imports: [CommonModule, FormsModule, FileBrowser],
  templateUrl: './file-uploader.html',
  styleUrl: './file-uploader.scss'
})
export class FileUploader implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  selectedFiles: File[] = [];
  isUploading = false;
  uploadStatus = '';
  uploadStatusClass = '';
  uploadStatusIcon = '';
  currentRoot: string = S3_ROOT_FOLDERS.IMAGES;
  targetPath: string = '';
  
  // Cache for file thumbnails and selections
  private fileThumbnails = new Map<File, string>();
  private selectedOriginals = new Set<File>();
  private selectedThumbnails = new Set<File>();
  private fileToThumbnail = new Map<File, File>();

  private destroy$ = new Subject<void>();

  constructor(
    public fileManager: FileManager,
    private cdr: ChangeDetectorRef
  ) {}

  get hasSelectedFiles(): boolean {
    return this.selectedOriginals.size > 0 || this.selectedThumbnails.size > 0;
  }

  get uploadProgress$() {
    return this.fileManager.uploadProgress$;
  }

  ngOnInit(): void {
    // Set initial root
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
      if (this.currentRoot === S3_ROOT_FOLDERS.ALBUMS+'/' && this.selectedThumbnails.size > 0) {
        const thumbnailPath = `${S3_ROOT_FOLDERS.THUMBNAILS}/albums/${this.targetPath ? this.targetPath + '/' : ''}`;
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

      await Promise.all(uploads);
      this.isUploading = false;
    } catch (error) {
      this.isUploading = false;
      this.uploadStatus = 'Upload failed: ' + (error as Error).message;
      this.uploadStatusClass = 'alert-danger';
      this.uploadStatusIcon = 'fa-exclamation-triangle';
      
      setTimeout(() => { this.uploadStatus = ''; }, 3000);
    }
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

  clearFiles(): void {
    this.selectedFiles = [];
    this.selectedOriginals.clear();
    this.selectedThumbnails.clear();
    this.fileToThumbnail.clear();
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
            // Create thumbnail file
            this.createThumbnailFile(file, result);
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
            const baseName = fileNameParts.join('.');
            
            // Si ALBUMS: nom identique (sans suffixe), sinon: suffixe avec dimensions
            let thumbnailName: string;
            if (this.currentRoot === S3_ROOT_FOLDERS.ALBUMS + '/') {
              thumbnailName = originalFile.name;
            } else {
              const ratio = (width / height).toFixed(2);
              thumbnailName = `${baseName}_${Math.round(width)}x${Math.round(height)}_${ratio}.${extension}`;
            }
            
            const thumbnailFile = new File([blob], thumbnailName, {
              type: originalFile.type
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
        }, originalFile.type, 0.8); // 80% quality
      }
    };
    
    img.src = dataUrl;
  }

  private clearThumbnails(): void {
    this.fileThumbnails.clear();
  }

  // Helper to get root folder options
  get rootFolders() {
    return S3_ROOT_FOLDERS;
  }
}
