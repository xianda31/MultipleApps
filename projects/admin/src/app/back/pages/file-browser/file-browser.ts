import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { FileManager } from '../../../services/file-manager';
import { FileService, S3_ROOT_FOLDERS } from '../../../common/services/files.service';
import JSZip from 'jszip';

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
  isDownloading: boolean = false;

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
    // Reset current path when changing root
    this.fileManager.setCurrentPath('');
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

  // Download methods
  async downloadCurrent(): Promise<void> {
    // Get root name without trailing slash
    const rootName = this.currentRoot.replace('/', '');
    
    // If no path selected OR path equals root name, we're at root level - download entire root as folder
    if (!this.currentPath || this.currentPath.trim() === '' || this.currentPath === rootName) {
      await this.downloadFolder();
      return;
    }
    
    const isFolder = this.isCurrentPathAFolder();
    
    if (isFolder) {
      await this.downloadFolder();
    } else {
      await this.downloadFile();
    }
  }

  async downloadFile(): Promise<void> {
    if (!this.currentPath) return;
    
    try {
      this.isDownloading = true;
      const fullPath = `${this.currentRoot}${this.currentPath}`;
      
      const blob = await this.fileService.download_file(fullPath);
      
      // Extract filename from path
      const fileName = this.currentPath.split('/').pop() || 'download';
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('FileBrowser: Error downloading file:', error);
      alert('Erreur lors du téléchargement du fichier');
    } finally {
      this.isDownloading = false;
    }
  }

  async downloadFolder(): Promise<void> {
    try {
      this.isDownloading = true;
      
      // Get root name without trailing slash
      const rootName = this.currentRoot.replace('/', '');
      
      // If currentPath equals root name or is empty, we're downloading the root folder
      const isRootDownload = !this.currentPath || this.currentPath.trim() === '' || this.currentPath === rootName;
      
      // Handle root download or subfolder download
      const folderPath = isRootDownload
        ? this.currentRoot // Just use root (e.g., "images/")
        : `${this.currentRoot}${this.currentPath}/`; // Use root + subpath
      
      // Get all files in folder recursively
      const files = await this.getAllFilesInFolder(folderPath, isRootDownload);
      
      if (files.length === 0) {
        alert('Le dossier est vide');
        this.isDownloading = false;
        return;
      }
      
      // Create a new ZIP file
      const zip = new JSZip();
      
      // Download all files and add them to the ZIP
      let successCount = 0;
      for (const filePath of files) {
        try {
          const blob = await this.fileService.download_file(filePath);
          
          // Get relative path within the folder for the ZIP structure
          const relativePath = filePath.replace(folderPath, '');
          
          // Skip empty files or system files
          if (blob.size === 0 || relativePath.startsWith('.')) {
            continue;
          }
          
          zip.file(relativePath, blob);
          successCount++;
        } catch (error) {
          console.error('FileBrowser: Error downloading file:', filePath, error);
        }
      }
      
      if (successCount === 0) {
        alert('Aucun fichier n\'a pu être téléchargé');
        this.isDownloading = false;
        return;
      }
      
      // Generate the ZIP file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // Download the ZIP file
      const folderName = this.currentPath 
        ? (this.currentPath.split('/').pop() || 'folder')
        : this.currentRoot.replace(/\/$/, '');
      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${folderName}.zip`;
      link.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      
      console.log(`FileBrowser: ZIP downloaded successfully with ${successCount} files`);
      // alert(`Dossier téléchargé : ${successCount} fichier(s) dans ${folderName}.zip`);
    } catch (error) {
      console.error('FileBrowser: Error downloading folder:', error);
      alert('Erreur lors du téléchargement du dossier');
    } finally {
      this.isDownloading = false;
    }
  }

  private async getAllFilesInFolder(folderPath: string, isRootDownload: boolean = false): Promise<string[]> {
    const files: string[] = [];
    
    // Navigate to the folder in the tree
    const cleanRoot = this.currentRoot.replace(/\/$/, '');
    
    if (!this.fileTree || !this.fileTree[cleanRoot]) {
      return files;
    }
    
    let node = this.fileTree[cleanRoot];
    
    // If we have a current path AND we're not downloading the root, navigate to it
    if (!isRootDownload && this.currentPath && this.currentPath.trim() !== '') {
      const relativePath = this.currentPath;
      const pathParts = relativePath.split('/').filter(part => part.length > 0);
      
      for (const part of pathParts) {
        if (!node || !node[part]) {
          return files;
        }
        node = node[part];
      }
    }
    
    // Recursively collect all files
    const collectFiles = (currentNode: any, prefix: string) => {
      if (!currentNode) return;
      for (const key in currentNode) {
        // Skip technical properties and hidden files
        if (key.startsWith('_') || key.startsWith('.')) continue;
        const value = currentNode[key];
        const fullPath = prefix ? `${prefix}/${key}` : key;
        if (this.isLeafNode(value)) {
          // Build S3 path correctly: always root + '/' + fullPath (no double slash)
          const s3Path = this.currentRoot.replace(/\/$/, '') + '/' + fullPath;
          files.push(s3Path);
        } else {
          collectFiles(value, fullPath);
        }
      }
    };
    collectFiles(node, '');
    return files;
  }
}
