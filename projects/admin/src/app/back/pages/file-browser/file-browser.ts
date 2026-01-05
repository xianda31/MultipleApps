import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { FileManager } from '../../../services/file-manager';
import { FileService, S3_ROOT_FOLDERS } from '../../../common/services/files.service';

@Component({
  selector: 'app-file-browser',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './file-browser.html',
  styleUrl: './file-browser.scss'
})
export class FileBrowser implements OnInit, OnDestroy {
  currentRoot: string = S3_ROOT_FOLDERS.IMAGES;
  currentPath: string = '';
  fileTree: any = {};
  isSelectionMode: boolean = false;
  selectionContext: string = '';
  selectionType: 'image' | 'document' | 'folder' | null = null;
  imagePreviewUrl: string | null = null;
  showCreateFolder: boolean = false;
  newFolderName: string = '';
  expandedFolders: Set<string> = new Set(); // Track expanded folders

  private subscriptions: Subscription[] = [];

  constructor(private fileManager: FileManager, private fileService: FileService) {}

  ngOnInit(): void {
    
    // Subscribe to file manager state
    this.subscriptions.push(
      this.fileManager.currentRoot$.subscribe(root => {
        this.currentRoot = root;
      }),
      this.fileManager.currentPath$.subscribe(path => {
        this.currentPath = path;
      }),
      this.fileManager.fileTree$.subscribe(tree => {
        this.fileTree = tree;
      }),
      this.fileManager.selectionMode$.subscribe(mode => {
        this.isSelectionMode = mode;
      }),
      this.fileManager.selectionRequest$.subscribe(request => {
        this.selectionContext = request?.context || '';
        this.selectionType = request?.type || null;
      })
    );

    // Initialize file manager with IMAGES root folder (default)
    this.fileManager.setCurrentRoot(S3_ROOT_FOLDERS.IMAGES);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  onRootChange(newRoot: string): void {
    this.fileManager.setCurrentRoot(newRoot);
  }

  onPathSelect(path: string): void {
    
    // Remove root prefix if it exists in the path
    let cleanPath = path;
    if (path.startsWith(this.currentRoot + '/')) {
      cleanPath = path.substring(this.currentRoot.length + 1);
    } else if (path.startsWith(this.currentRoot)) {
      cleanPath = path.substring(this.currentRoot.length);
      if (cleanPath.startsWith('/')) {
        cleanPath = cleanPath.substring(1);
      }
    }
    
    this.fileManager.setCurrentPath(cleanPath);
    
    // Update image preview if it's an image in selection mode
    if (this.isSelectionMode && this.selectionType === 'image' && this.isImageFile(cleanPath)) {
      this.updateImagePreview(cleanPath);
    }
  }

  applySelection(): void {
    const result = this.fileManager.applySelection();
    if (result) {
    }
  }

  cancelSelection(): void {
    this.fileManager.cancelSelectionMode();
  }

  // Template helper methods
  getObjectKeys(obj: any): string[] {
    if (!obj) return [];
    
    // Filter out technical properties that shouldn't be displayed
    const excludedKeys = ['__data', 'path', 'etag', 'lastModified', 'size', 'url$'];
    
    const rawKeys = Object.keys(obj).filter(key => 
      !excludedKeys.includes(key) && 
      !key.startsWith('_') && // Exclude any property starting with underscore
      key !== '.folder_placeholder' && // Exclude folder placeholder files
      typeof key === 'string'
    );
    
    // Clean folder names by removing trailing slash for display
    return rawKeys.map(key => key.endsWith('/') ? key.slice(0, -1) : key);
  }

  // Get clean root without trailing slash for template comparisons
  getCleanRoot(): string {
    return this.currentRoot.replace(/\/$/, '');
  }

  // Get the actual key from the node object (might have trailing slash)
  getOriginalKey(node: any, cleanKey: string): string {
    if (!node) return cleanKey;
    
    // Try the clean key first
    if (node[cleanKey] !== undefined) {
      return cleanKey;
    }
    
    // Try with trailing slash for folders
    if (node[cleanKey + '/'] !== undefined) {
      return cleanKey + '/';
    }
    
    return cleanKey;
  }

  isLeafNode(node: any): boolean {
    // A leaf node is a file if it's a string OR if it only contains __data without other file/folder children
    if (typeof node === 'string') {
      return true;
    }
    
    if (typeof node === 'object' && node) {
      const displayableKeys = this.getObjectKeys(node);
      
      // Special case: if the node has .folder_placeholder, it's a folder (empty or not)
      // This handles newly created folders that have both __data and .folder_placeholder
      if (node['.folder_placeholder'] !== undefined) {
        return false; // It's a folder, not a file
      }
      
      // If no displayable keys but has __data, it's a file
      return displayableKeys.length === 0 && node.__data;
    }
    
    return false;
  }

  // Expose S3 folders to template (excluding SYSTEM)
  get availableFolders() {
    return {
      IMAGES: S3_ROOT_FOLDERS.IMAGES,
      DOCUMENTS: S3_ROOT_FOLDERS.DOCUMENTS,
      ALBUMS: S3_ROOT_FOLDERS.ALBUMS,
      PORTRAITS: S3_ROOT_FOLDERS.PORTRAITS,
      THUMBNAILS: S3_ROOT_FOLDERS.THUMBNAILS,
      ACCOUNTING: S3_ROOT_FOLDERS.ACCOUNTING
    };
  }

  getFolderKeys() {
    return Object.values(S3_ROOT_FOLDERS).filter(folder => folder !== S3_ROOT_FOLDERS.SYSTEM);
  }

  // Folder management methods
  async createFolder(): Promise<void> {
    const name = (this.newFolderName || '').trim();
    if (!name) return;

    try {
      const parentPath = this.currentPath ? `${this.currentRoot}${this.currentPath}/` : this.currentRoot;
      const folderPath = `${parentPath}${name}/`;
      
      
      // Create empty folder by uploading a placeholder
      const emptyFile = new File([new Blob([])], '.folder_placeholder');
      await this.fileManager.uploadFile(emptyFile, folderPath);
      
      // Reset form first
      this.newFolderName = '';
      this.showCreateFolder = false;
      
      // Force refresh the tree after a short delay to ensure S3 has processed the upload
      setTimeout(() => {
        console.log('FileBrowser: Refreshing tree after folder creation');
        this.fileManager.setCurrentRoot(this.currentRoot);
      }, 500);
      
      console.log('FileBrowser: Folder created:', folderPath);
    } catch (error) {
      console.error('FileBrowser: Error creating folder:', error);
      // Reset form even on error
      this.newFolderName = '';
      this.showCreateFolder = false;
    }
  }

  // Folder expansion methods
  toggleFolderExpansion(folderPath: string): void {
    if (this.expandedFolders.has(folderPath)) {
      this.expandedFolders.delete(folderPath);
    } else {
      this.expandedFolders.add(folderPath);
    }
  }

  isFolderExpanded(folderPath: string): boolean {
    return this.expandedFolders.has(folderPath);
  }

  // Path type detection methods
  isCurrentPathAFolder(): boolean {
    
    if (!this.currentPath) {
      return true; // Root is always a folder
    }
    
    // Clean the current root (remove trailing slash if present)
    const cleanCurrentRoot = this.currentRoot.replace(/\/$/, '');
    
    // First navigate to the current root in the file tree
    if (!this.fileTree || !this.fileTree[cleanCurrentRoot]) {
      return false;
    }
    
    // Start from the current root node
    let node = this.fileTree[cleanCurrentRoot];
    
    // Navigate through the relative path within the current root
    const pathParts = this.currentPath.split('/').filter(part => part.length > 0);
    
    for (const part of pathParts) {
      if (!node || !node[part]) {
        return false;
      }
      node = node[part];
    }
    
    
    // If it's a leaf node (string or object with no displayable children), it's a file
    const isFolder = !this.isLeafNode(node);
    return isFolder;
  }

  // File management methods
  async deleteCurrentFile(): Promise<void> {
    if (!this.currentPath || this.isCurrentPathAFolder()) {
      return;
    }
    
    if (confirm(`Supprimer le fichier "${this.currentPath}" ?`)) {
      try {
        const filePath = `${this.currentRoot}${this.currentPath}`;
        await this.fileManager.deleteFile(filePath);
        
        // Navigate back to parent folder
        const pathParts = this.currentPath.split('/');
        pathParts.pop();
        this.fileManager.setCurrentPath(pathParts.join('/'));
        
        // Refresh the tree
        this.fileManager.setCurrentRoot(this.currentRoot);
        
        console.log('FileBrowser: File deleted:', filePath);
      } catch (error) {
        console.error('FileBrowser: Error deleting file:', error);
      }
    }
  }
  async deleteCurrentFolder(): Promise<void> {
    if (!this.currentPath) return;
    
    if (confirm(`Supprimer le dossier "${this.currentPath}" et tout son contenu ?`)) {
      try {
        const folderPath = `${this.currentRoot}${this.currentPath}/`;
        await this.fileManager.deleteFolder(folderPath);
        
        // Navigate back to parent
        const pathParts = this.currentPath.split('/');
        pathParts.pop();
        this.fileManager.setCurrentPath(pathParts.join('/'));
        
        // Refresh the tree
        this.fileManager.setCurrentRoot(this.currentRoot);
        
        console.log('FileBrowser: Folder deleted:', folderPath);
      } catch (error) {
        console.error('FileBrowser: Error deleting folder:', error);
      }
    }
  }

  // Get appropriate icon for file type
  getFileIcon(fileName: string): string {
    const extension = fileName.toLowerCase().split('.').pop();
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'svg':
      case 'webp':
        return 'bi bi-image text-primary';
      
      case 'pdf':
        return 'bi bi-file-pdf text-danger';
      
      case 'doc':
      case 'docx':
        return 'bi bi-file-word text-primary';
      
      case 'xls':
      case 'xlsx':
        return 'bi bi-file-excel text-success';
      
      case 'txt':
      case 'md':
        return 'bi bi-file-text text-secondary';
      
      case 'zip':
      case 'rar':
      case '7z':
        return 'bi bi-file-zip text-warning';
      
      case 'mp4':
      case 'avi':
      case 'mov':
        return 'bi bi-play-circle text-info';
      
      case 'mp3':
      case 'wav':
        return 'bi bi-music-note text-info';
      
      case 'html':
      case 'css':
      case 'js':
      case 'ts':
        return 'bi bi-code text-success';
      
      default:
        return 'bi bi-file-earmark text-secondary';
    }
  }
  
  // === HELPER METHODS FOR SELECTION ===
  
  getRootDisplayName(root: string): string {
    switch (root) {
      case 'images': return 'Images';
      case 'documents': return 'Documents';
      case 'albums': return 'Albums';
      default: return root;
    }
  }
  
  getNameFromPath(path: string): string {
    if (!path) return '';
    const segments = path.split('/');
    return segments[segments.length - 1] || '';
  }
  
  isImageFile(path: string): boolean {
    if (!path) return false;
    const fileName = path.toLowerCase();
    const extension = fileName.split('.').pop() || '';
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension);
  }

  
  getImagePreviewUrl(path: string): string {
    return this.imagePreviewUrl || '';
  }
  
  updateImagePreview(path: string): void {
    if (!path || !this.currentRoot) {
      this.imagePreviewUrl = null;
      return;
    }
    
    const fullPath = this.currentRoot + path;
    
    this.fileService.getPresignedUrl$(fullPath, true).subscribe({
      next: (url) => {
        this.imagePreviewUrl = url;
      },
      error: (error) => {
        this.imagePreviewUrl = null;
      }
    });
  }
}
