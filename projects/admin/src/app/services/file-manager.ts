import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { FileService, S3_ROOT_FOLDERS } from '../common/services/files.service';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
  lastModified?: Date;
  url?: string;
}

export interface FileSelectionRequest {
  type: 'image' | 'document' | 'folder';
  context: string;
  targetId?: string; // ID of the requesting component/snippet
}

export interface FileUploadProgress {
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FileManager {
  // Current navigation state
  private currentRootSubject = new BehaviorSubject<string>(S3_ROOT_FOLDERS.IMAGES);
  private currentPathSubject = new BehaviorSubject<string>('');
  private fileTreeSubject = new BehaviorSubject<any>({});
  
  // Selection state
  private selectionModeSubject = new BehaviorSubject<boolean>(false);
  private selectionRequestSubject = new BehaviorSubject<FileSelectionRequest | null>(null);
  private selectedFileSubject = new BehaviorSubject<string | null>(null);
  
  // Upload state
  private uploadProgressSubject = new BehaviorSubject<FileUploadProgress[]>([]);
  private filesByRootSubject = new BehaviorSubject<{ [key: string]: File[] }>({});
  
  // Public observables
  public currentRoot$ = this.currentRootSubject.asObservable();
  public currentPath$ = this.currentPathSubject.asObservable();
  public fileTree$ = this.fileTreeSubject.asObservable();
  public selectionMode$ = this.selectionModeSubject.asObservable();
  public selectionRequest$ = this.selectionRequestSubject.asObservable();
  public selectedFile$ = this.selectedFileSubject.asObservable();
  public uploadProgress$ = this.uploadProgressSubject.asObservable();
  public filesByRoot$ = this.filesByRootSubject.asObservable();
  
  // Events for inter-component communication
  private fileSelectedSubject = new Subject<{path: string, type: string, context?: string, targetId?: string}>();
  public fileSelected$ = this.fileSelectedSubject.asObservable();

  constructor(private fileService: FileService) {
    this.initializeFilesByRoot();
  }

  private initializeFilesByRoot(): void {
    const initialFiles: { [key: string]: File[] } = {};
    Object.values(S3_ROOT_FOLDERS).forEach(folder => {
      initialFiles[folder] = [];
    });
    this.filesByRootSubject.next(initialFiles);
  }

  // === NAVIGATION METHODS ===
  
  setCurrentRoot(root: string): void {
    // Ensure root ends with '/' for S3 permissions
    const rootWithSlash = root.endsWith('/') ? root : root + '/';
    
    this.currentRootSubject.next(rootWithSlash);
    this.currentPathSubject.next(''); // Reset path when changing root
    this.loadFileTree(rootWithSlash);
  }

  setCurrentPath(path: string): void {
    this.currentPathSubject.next(path);
    this.selectedFileSubject.next(path);
  }

  getCurrentRoot(): string {
    return this.currentRootSubject.value;
  }

  getCurrentPath(): string {
    return this.currentPathSubject.value;
  }

  private async loadFileTree(root: string): Promise<void> {
    
    // Use real S3 API directly like file-system-selector does
    this.fileService.list_files(root).subscribe({
      next: (items) => {
        const tree = this.fileService.generate_filesystem(items);
        this.fileTreeSubject.next(tree);
      },
      error: (error) => {
        console.error('FileManager: Error loading S3 file tree:', error);
        this.fileTreeSubject.next({});
      }
    });
  }



  // === SELECTION METHODS ===
  
  activateSelectionMode(request: FileSelectionRequest): void {
    this.selectionModeSubject.next(true);
    this.selectionRequestSubject.next(request);
    
    // Switch to appropriate root folder
    if (request.type === 'image') {
      this.setCurrentRoot(S3_ROOT_FOLDERS.IMAGES);
    } else if (request.type === 'document') {
      this.setCurrentRoot(S3_ROOT_FOLDERS.DOCUMENTS);
    } else if (request.type === 'folder') {
      this.setCurrentRoot(S3_ROOT_FOLDERS.ALBUMS);
    }
  }

  cancelSelectionMode(): void {
    this.selectionModeSubject.next(false);
    this.selectionRequestSubject.next(null);
    this.selectedFileSubject.next(null);
  }

  applySelection(): {path: string, type: string, context: string, targetId?: string} | null {
    const currentRequest = this.selectionRequestSubject.value;
    const selectedPath = this.selectedFileSubject.value;
    
    if (!currentRequest || !selectedPath) {
      return null;
    }

    const result = {
      path: selectedPath,
      type: currentRequest.type,
      context: currentRequest.context,
      targetId: currentRequest.targetId
    };

    // Emit the selection event
    this.fileSelectedSubject.next(result);
    
    // Reset selection state
    this.cancelSelectionMode();
    
    return result;
  }

  // === UPLOAD METHODS ===
  
  addFilesToUpload(targetPath: string, files: File[]): void {
    console.log('FileManager: Adding files to upload queue for path:', targetPath);
    console.log('FileManager: Files to add:', files.map(f => f.name));
    
    const currentFiles = this.filesByRootSubject.value;
    const updatedFiles = {
      ...currentFiles,
      [targetPath]: [...(currentFiles[targetPath] || []), ...files]
    };
    this.filesByRootSubject.next(updatedFiles);
  }

  async uploadFiles(targetPath: string): Promise<void> {
    const files = this.filesByRootSubject.value[targetPath] || [];
    
    console.log('FileManager: Uploading files to:', targetPath);
    console.log('FileManager: Files to upload:', files.length);
    
    if (files.length === 0) {
      throw new Error('No files to upload');
    }

    // Initialize progress tracking
    const progressItems: FileUploadProgress[] = files.map(file => ({
      fileName: file.name,
      progress: 0,
      status: 'pending'
    }));
    this.uploadProgressSubject.next(progressItems);

    try {
      // Real upload process using fileService
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const progressItem = progressItems[i];
        progressItem.status = 'uploading';
        this.uploadProgressSubject.next([...progressItems]);
        
        try {
          // Upload file to S3 using the file service
          await this.fileService.upload_file(file, targetPath);
          
          progressItem.progress = 100;
          progressItem.status = 'completed';
        } catch (error) {
          progressItem.status = 'error';
          progressItem.error = error instanceof Error ? error.message : 'Upload failed';
          console.error('FileManager: Upload failed for file:', file.name, error);
        }
        
        this.uploadProgressSubject.next([...progressItems]);
      }

      // Clear upload queue and refresh file tree
      const currentFiles = this.filesByRootSubject.value;
      delete currentFiles[targetPath];
      this.filesByRootSubject.next({...currentFiles});
      
      // Extract root from targetPath to refresh the tree
      const root = targetPath.split('/')[0];
      this.loadFileTree(root + '/');
      
    } catch (error) {
      console.error('FileManager: Upload process failed:', error);
      throw error;
    }
  }

  // === UTILITY METHODS ===
  
  getAcceptFilter(root: string): string {
    switch (root) {
      case S3_ROOT_FOLDERS.IMAGES:
        return 'image/*';
      case S3_ROOT_FOLDERS.DOCUMENTS:
        return '.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx';
      default:
        return '*/*';
    }
  }

  isSelectionMode(): boolean {
    return this.selectionModeSubject.value;
  }

  // === FOLDER MANAGEMENT METHODS ===
  
  async uploadFile(file: File, targetPath: string): Promise<void> {
    try {
      await this.fileService.upload_file(file, targetPath);
    } catch (error) {
      console.error('FileManager: Error uploading file:', error);
      throw error;
    }
  }

  async deleteFolder(folderPath: string): Promise<void> {
    try {
      await this.fileService.deleteFolderRecursive(folderPath);
    } catch (error) {
      console.error('FileManager: Error deleting folder:', error);
      throw error;
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await this.fileService.delete_file(filePath);
    } catch (error) {
      console.error('FileManager: Error deleting file:', error);
      throw error;
    }
  }

  getCurrentSelectionRequest(): FileSelectionRequest | null {
    return this.selectionRequestSubject.value;
  }
}
