import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ElementRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileService } from '../../../common/services/files.service';
import { NgbModal, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import { GetConfirmationComponent } from '../../../common/modals/get-confirmation.component';
import { ToastService } from '../../../common/services/toast.service';
import { ZipService } from '../../../common/services/zip.service';

@Component({
  selector: 'app-file-system-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbModalModule],
  templateUrl: './file-system-selector.component.html',
  styleUrls: ['./file-system-selector.component.scss']
})
export class FileSystemSelectorComponent implements OnInit, OnChanges {
  @Input() allowActions: boolean = true;
  @Input() selectOnFolderClick: boolean = true;
  downloadingZipFolder: string | null = null;
  // Sélectionne un fichier ou dossier et émet l'événement select
  selectPath(path: string) {
    this.onSelect(path);
  }

          async deleteFile(path: string) {
            if (!path) return;
            try {
              await this.fileService.delete_file(path);
              this.toast.showSuccess('Fichier', 'Fichier supprimé');
              this.refresh();
            } catch (err) {
              console.error('deleteFile error', err);
              this.toast.showErrorToast('Fichier', 'Erreur suppression fichier');
            }
          }
        // Permet de forcer le rafraîchissement de l'arborescence
        public refresh() {
          if (this.rootFolder) {
            this.fileService.list_files(this.rootFolder).subscribe((items) => {
              this.items = items;
              this.tree = this.fileService.generate_filesystem(items);
            });
          }
        }
      ngOnChanges(changes: SimpleChanges): void {
        if (changes['rootFolder'] && changes['rootFolder'].currentValue) {
          this.currentPath = '';
          this.expanded.clear();
          this.showCreateFolder = false;
          this.newFolderName = '';
          this.items = null;
          this.tree = null;
          this.fileService.list_files(this.rootFolder!).subscribe((items) => {
            this.items = items;
            this.tree = this.fileService.generate_filesystem(items);
          });
        }
      }
    currentPath: string = '';
  @Input() rootFolder: string | null = null; // e.g. 'images/'
  @Input() mode: 'files' | 'folders' | 'both' = 'files';
  @Input() allowCreateFolder: boolean = false;
  @Input() items: any[] | null = null;
  @Input() tree: any = null;
  @Output() select = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();

  expanded = new Set<string>();
  showCreateFolder = false;
  newFolderName: string = '';

  constructor(
    private fileService: FileService,
    private el: ElementRef,
    private renderer: Renderer2,
    private toast: ToastService,
    private modalService: NgbModal,
    private zipService: ZipService
  ) {}

  async downloadFolderZip(path: string) {
    if (!path) return;
    this.downloadingZipFolder = path;
    try {
      const name = path.endsWith('/') ? path.slice(0, -1) : path;
      await this.zipService.downloadFolderAsZip(path, name.split('/').pop() + '.zip');
      this.toast.showSuccess('Téléchargement', 'Archive générée');
    } catch (err) {
      this.toast.showErrorToast('Téléchargement', 'Erreur lors de la génération de l’archive.');
    } finally {
      this.downloadingZipFolder = null;
    }
  }

  async deleteFolder(path: string) {
    if (!path) return;
    try {
      const modalRef = this.modalService.open(GetConfirmationComponent, { centered: true });
      const confirmed = await modalRef.result;
      if (!confirmed) return;
      this.toast.showInfo('Dossier', `Suppression du dossier : ${path}`);
      await this.fileService.deleteFolderRecursive(path);
      this.toast.showSuccess('Dossier', 'Dossier et contenu supprimés');
      this.refresh();
    } catch (err) {
      if (err !== false) {
        console.error('deleteFolder error', err);
        this.toast.showErrorToast('Dossier', 'Erreur suppression dossier');
      }
    }
  }
  ngOnInit(): void {
    try {
      const isInModal = !!this.el.nativeElement.closest('.modal') || !!this.el.nativeElement.closest('.modal-content');
      if (isInModal) this.renderer.addClass(this.el.nativeElement, 'in-modal');
      else this.renderer.addClass(this.el.nativeElement, 'not-in-modal');
    } catch (e) {}

    if ((!this.items || !this.tree) && this.rootFolder) {
      this.fileService.list_files(this.rootFolder).subscribe((items) => {
        this.items = items;
        this.tree = this.fileService.generate_filesystem(items);
      });
    }
  }

  nodeKeys(node: any) { return node ? Object.keys(node).filter(k => k !== '__data') : []; }

  isFolder(node: any, key: string) {
    const child = node && node[key];
    if (!child) return false;
    const childKeys = this.nodeKeys(child);
    if (childKeys.length > 0) return true;
    if (child.__data && child.__data.path && child.__data.size === 0) return true;
    return false;
  }

  toggleExpanded(path: string) {
    if (this.expanded.has(path)) {
      this.expanded.delete(path);
    } else {
      this.expanded.add(path);
      this.currentPath = path;
      if (this.selectOnFolderClick) {
        this.onSelect(path);
      }
    }
  }

  // Helper pour savoir si un path est un dossier dans l'arborescence
  isFolderFromPath(path: string): boolean {
    if (!this.tree) return false;
    const parts = path.split('/').filter(Boolean);
    let node = this.tree;
    for (const part of parts) {
      if (!node[part]) return false;
      node = node[part];
    }
    // Un dossier a potentiellement des enfants ou un __data.size === 0
    return Object.keys(node).some(k => k !== '__data') || (node.__data && node.__data.size === 0);
  }
  isExpanded(path: string) { return this.expanded.has(path); }

  getItemByPath(path: string) { return this.items ? this.items.find(it => it.path === path) : null; }

  onSelect(path: string) {
    // Always emit folder path with trailing slash if it's a folder
    let normalized = path;
    if (this.isFolderFromPath(path) && !path.endsWith('/')) {
      normalized = path + '/';
    }
    this.select.emit(normalized);
  }
  onClose() { this.close.emit(); }

  async createFolder() {
    const name = (this.newFolderName || '').trim();
    if (!name) {
      this.toast.showErrorToast('Dossier', 'Nom de dossier requis');
      return;
    }
    let parent = this.currentPath || this.rootFolder;
    if (parent && !parent.endsWith('/')) parent += '/';
    if (!parent) {
      this.toast.showErrorToast('Dossier', 'Racine non définie');
      return;
    }
    // Ensure trailing slash on folder marker
    const folderMarkerName = name.endsWith('/') ? name : name + '/';
    try {
      const file = new File([new Blob([])], folderMarkerName);
      await this.fileService.upload_file(file, parent);
      this.toast.showSuccess('Dossier', 'Dossier créé');
      // refresh listing
      this.fileService.list_files(parent).subscribe((items) => {
        this.items = items;
        this.tree = this.fileService.generate_filesystem(items);
        this.newFolderName = '';
        this.showCreateFolder = false;
      });
    } catch (err) {
      console.error('createFolder error', err);
      this.toast.showErrorToast('Dossier', 'Erreur création dossier');
    }
  }
}
