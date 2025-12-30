import { ViewChild } from '@angular/core';

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileService, S3_ROOT_FOLDERS } from '../../../common/services/files.service';
import { ImgService } from '../../../common/services/img.service';
import { ToastService } from '../../../common/services/toast.service';
import { FileSystemSelectorComponent } from '../../pages/file-system-selector/file-system-selector.component';
import { SystemDataService } from '../../../common/services/system-data.service';
import { ImageSize } from '../../../common/interfaces/ui-conf.interface';

@Component({
  selector: 'app-uploader',
  standalone: true,
  imports: [CommonModule, FormsModule, FileSystemSelectorComponent],
  templateUrl: './uploader.html',
  styleUrls: ['./uploader.scss']
})

export class UploaderComponent {

  showCreateRootFolder = false;
  newRootFolderName = '';
  currentNavFolder: string = '';
  targetRoot: string = S3_ROOT_FOLDERS.IMAGES;
  S3_ROOT_FOLDERS = S3_ROOT_FOLDERS;
  data_usage!: Record<S3_ROOT_FOLDERS, string[]>;
  filesByRoot: { [key: string]: File[] } = {};
  previewImagesByRoot: { [key: string]: string[] } = {};
  previewLighterImagesByRoot: { [key: string]: string[] } = {};
  lighterFilesByRoot: { [key: string]: File[] } = {}; // Stocke les fichiers allégés
  previewImagesMetaByRoot: { [key: string]: Array<{ width: number, height: number, sizeKB: number, selected: boolean }> } = {};
  previewLighterImagesMetaByRoot: { [key: string]: Array<{ width: number, height: number, sizeKB: number, selected: boolean }> } = {};
  targetFolderByRoot: { [key: string]: string } = {};
  uploading = false;
  uploadedItems: Array<{ path: string; size: number; url?: string }> = [];
  card_img_sizes: ImageSize[] = [];
  refreshNav: (() => void) | null = null;
    @ViewChild('fsNav') fsNavComponent?: any;
  ngAfterViewInit(): void {
    if (this.fsNavComponent && typeof this.fsNavComponent.refresh === 'function') {
      this.refreshNav = () => this.fsNavComponent!.refresh();
    }
  }


  constructor(
    private fileService: FileService,
    private toast: ToastService,
    private imgService: ImgService,
    private systemDataService: SystemDataService
  ) {
    this.systemDataService.get_ui_settings().subscribe((ui) => {
      this.card_img_sizes = Array.isArray((ui as any)?.card_thumbnails)
        ? (ui as any).card_thumbnails
        : [(ui as any)?.thumbnail || { width: 300, height: 200, ratio: 1.78 }];

      this.data_usage = {
        [S3_ROOT_FOLDERS.IMAGES]: [
          'Images ou photos (jpg, png, gif) utilisées en illustration dans les articles, ou le carousel de la page d\'acceuil.',
          `Des versions reformatées de ratio (${this.card_img_sizes.map(s => (s.width / s.height).toFixed(2)).join(', ')}) et résolution optimisés pour le web sont automatiquement créées en sus.`,
          'nota :',
          ' - pour les images des articles, ne conservez que les images reformatées (moins lourdes).',
          ' - pour le carousel de la page d\'accueil ne chargez que les images originales de haute résolution.'
        ],
        [S3_ROOT_FOLDERS.ALBUMS]: [
          'Photos en haute résolution (jpg, png), format et résolution originaux, pour les albums photos',
          'nota : des vignettes pour le preview des dossiers albums sont générées automatiquement.'
        ],
        [S3_ROOT_FOLDERS.DOCUMENTS]: [
          'Documents (pdf, doc, docx) en accès public ou privé',
          'utilisés pour les téléchargements par les visiteurs du site.'
        ],
        // racines non visibles pour ce composant (uniquement pour compilation data usage)
        [S3_ROOT_FOLDERS.PORTRAITS]: [],
        [S3_ROOT_FOLDERS.THUMBNAILS]: [],
        [S3_ROOT_FOLDERS.SYSTEM]: [],
        [S3_ROOT_FOLDERS.ACCOUNTING]: []
      };
    });
  }

  async createRootFolder() {
    const name = (this.newRootFolderName || '').trim();
    if (!name) {
      this.toast.showErrorToast('Dossier', 'Nom de dossier requis');
      return;
    }
    let parent = this.currentNavFolder || (this.targetRoot + '/');
    if (parent && !parent.endsWith('/')) parent += '/';
    if (!parent) {
      this.toast.showErrorToast('Dossier', 'Racine non définie');
      return;
    }
    const folderMarkerName = name.endsWith('/') ? name : name + '/';
    try {
      const file = new File([new Blob([])], folderMarkerName);
      await this.fileService.upload_file(file, parent);
      this.toast.showSuccess('Dossier', 'Dossier créé');
      this.showCreateRootFolder = false;
      this.newRootFolderName = '';
      // Optionnel : rafraîchir la navigation si besoin
    } catch (err) {
      console.error('createRootFolder error', err);
      this.toast.showErrorToast('Dossier', 'Erreur création dossier');
    }
  }

  // Pour la navigation file-system-selector (card de droite)
  onFileSelectedFromNav(path: string) {
    // Si c'est un dossier, on l'utilise comme dossier courant
    if (path.endsWith('/')) {
      this.currentNavFolder = path;
    } else {
      // Si c'est un fichier, on prend son dossier parent
      const idx = path.lastIndexOf('/');
      this.currentNavFolder = idx >= 0 ? path.substring(0, idx + 1) : '';
    }
    // Optionnel : toast ou autre action
  }
  // La sélection de dossier se fait désormais via la navigation à droite
  chooseFolder(root?: string) {
    // Ne fait plus rien, conservé pour compatibilité éventuelle
  }

  onFilesSelected(ev: Event, root?: string) {
    const input = ev.target as HTMLInputElement;
    if (!input.files) return;
    const key = (root ?? this.targetRoot).toString();
    const files = Array.from(input.files);
    this.filesByRoot[key] = files;
    // Génère les URLs de prévisualisation pour les images originales
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    this.previewImagesByRoot[key] = imageFiles.map(f => URL.createObjectURL(f));
    this.previewImagesMetaByRoot[key] = [];
    imageFiles.forEach(async (f, i) => {
      const dim = await this.imgService.imageDimensions(f);
      this.previewImagesMetaByRoot[key][i] = {
        width: dim?.width || 0,
        height: dim?.height || 0,
        sizeKB: Math.round(f.size / 1024),
        selected: true
      };
    });

    // Génère les images allégées en local pour prévisualisation (attend la fin de toutes les promesses)
    (async () => {
      const lighterUrls: string[] = [];
      const lighterMetas: Array<{ width: number, height: number, sizeKB: number, selected: boolean }> = [];
      const lighterFilesArr: File[] = [];
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        const lighterFiles = await this.imgService.createLighterFiles(file, this.card_img_sizes);
        for (const { file: lighterFile, size } of lighterFiles) {
          const url = URL.createObjectURL(lighterFile);
          lighterUrls.push(url);
          lighterMetas.push({
            width: size.width,
            height: size.height,
            sizeKB: Math.round(lighterFile.size / 1024),
            selected: true
          });
          lighterFilesArr.push(lighterFile);
        }
      }
      this.previewLighterImagesByRoot[key] = lighterUrls;
      this.previewLighterImagesMetaByRoot[key] = lighterMetas;
      this.lighterFilesByRoot[key] = lighterFilesArr;
    })();
  }
  
  togglePreviewImageSelection(root: string, index: number, isLighter: boolean): void {
    if (isLighter) {
      const arr = this.previewLighterImagesMetaByRoot[root];
      if (arr && arr[index]) arr[index].selected = !arr[index].selected;
    } else {
      const arr = this.previewImagesMetaByRoot[root];
      if (arr && arr[index]) arr[index].selected = !arr[index].selected;
    }
  }

  getDataUsageForRoot(root: any): string[] {
    if (!this.data_usage) return ['Aucune donnée'];
    return this.data_usage[root as S3_ROOT_FOLDERS] && this.data_usage[root as S3_ROOT_FOLDERS].length > 0
      ? this.data_usage[root as S3_ROOT_FOLDERS]
      : ['Aucune donnée'];
  }


  async uploadAllFor(root?: string) {
    const key = (root ?? this.targetRoot).toString();
    const tf = this.currentNavFolder;
    let files = this.filesByRoot[key] ?? [];
    // Filtre les fichiers originaux selon la sélection
    const metaArr = this.previewImagesMetaByRoot[key];
    const lighterMetaArr = this.previewLighterImagesMetaByRoot[key];
    let selectedOriginalCount = files.length;
    let selectedLighterCount = lighterMetaArr ? lighterMetaArr.filter(m => m.selected).length : 0;
    let selectedOriginalFiles: File[] = files;
    if (metaArr && metaArr.length === files.length) {
      selectedOriginalFiles = files.filter((_, i) => metaArr[i]?.selected);
      selectedOriginalCount = metaArr.filter(m => m.selected).length;
    }
    // Nettoie les previews après upload
    this.previewImagesByRoot[key]?.forEach(url => URL.revokeObjectURL(url));
    this.previewImagesByRoot[key] = [];
    this.previewLighterImagesByRoot[key]?.forEach(url => URL.revokeObjectURL(url));
    this.previewLighterImagesByRoot[key] = [];
    if (!tf) {
      this.toast.showWarning('Uploader', 'Veuillez choisir un dossier cible');
      return;
    }
    // Vérifie qu'au moins un fichier original ou allégé est sélectionné
    if (selectedOriginalCount === 0 && selectedLighterCount === 0) {
      this.toast.showWarning('Uploader', 'Aucun fichier sélectionné');
      return;
    }
    this.uploading = true;
    try {
      // Upload des originaux sélectionnés
      for (let fileIdx = 0; fileIdx < selectedOriginalFiles.length; fileIdx++) {
        const f = selectedOriginalFiles[fileIdx];
        await this.fileService.upload_file(f, tf);
        const path = tf + f.name;
        let url: string | undefined = undefined;
        try {
          url = await this.fileService.getPresignedUrl$(path).toPromise();
        } catch {}
        this.uploadedItems.push({ path, size: f.size, url });
      }
      // Upload des images allégées sélectionnées
      const currentRoot = (root ?? this.targetRoot);
      if ((currentRoot === S3_ROOT_FOLDERS.IMAGES || currentRoot === S3_ROOT_FOLDERS.ALBUMS) && lighterMetaArr && lighterMetaArr.length > 0) {
        const lighterFilesArr = this.lighterFilesByRoot[key] || [];
        for (let i = 0; i < lighterFilesArr.length; i++) {
          if (!lighterMetaArr[i]?.selected) continue;
          const lighterFile = lighterFilesArr[i];
          let lighterTargetFolder = tf;
          let lighterFileToUpload = lighterFile;
          let lighterFileName = lighterFile.name;
          if (currentRoot === S3_ROOT_FOLDERS.ALBUMS) {
            const albumsPrefix = S3_ROOT_FOLDERS.ALBUMS + '/';
            const thumbnailsPrefix = S3_ROOT_FOLDERS.THUMBNAILS + '/albums/';
            if (tf.startsWith(albumsPrefix)) {
              lighterTargetFolder = thumbnailsPrefix + tf.substring(albumsPrefix.length);
            } else {
              lighterTargetFolder = tf.replace(S3_ROOT_FOLDERS.ALBUMS, S3_ROOT_FOLDERS.THUMBNAILS+ '/albums/');
            }
            lighterFileName = selectedOriginalFiles[i]?.name || lighterFile.name;
            if (lighterFile.name !== lighterFileName) {
              lighterFileToUpload = new File([lighterFile], lighterFileName, { type: lighterFile.type });
            }
          }
          await this.fileService.upload_file(lighterFileToUpload, lighterTargetFolder);
          let url: string | undefined = undefined;
          try {
            url = await this.fileService.getPresignedUrl$(lighterTargetFolder + lighterFileName).toPromise();
          } catch {}
          this.uploadedItems.push({ path: lighterTargetFolder + lighterFileName, size: lighterFileToUpload.size, url });
          this.toast.showSuccess('Uploader', `Image allégée téléchargée avec succès`);
        }
      }
      this.toast.showSuccess('Uploader', 'Fichiers téléchargés avec succès');
      this.filesByRoot[key] = [];
      // Reset du dossier courant après upload
      this.currentNavFolder = '';
      // Déclenche le rafraîchissement du file-system-selector si défini
      if (this.refreshNav) {
        this.refreshNav();
      }
    } catch (err) {
      console.error(err);
      this.toast.showErrorToast('Uploader', 'Erreur pendant l\'upload');
    } finally {
      this.uploading = false;
    }
  }


  // Génère une version allégée d'une image (suffixe w x h) via ImgService
  async createLightenFile(file: File, size: ImageSize): Promise<File | null> {
    if (!size) return null;
    return await this.imgService.createLightenFile(file, size.width, size.height);
  }

  triggerFileDialog(root: string) {
    try {
      const el = document.getElementById('file-input-' + root);
      (el as HTMLInputElement | null)?.click();
    } catch (e) {
      console.error('triggerFileDialog error', e);
    }
  }

  acceptFilter(root?: string): string {
    const r = root ?? this.targetRoot;
    switch (r) {
      case S3_ROOT_FOLDERS.DOCUMENTS:
        return 'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case S3_ROOT_FOLDERS.ALBUMS:
      case S3_ROOT_FOLDERS.IMAGES:
        return 'image/*';
      default:
        return '*/*';
    }
  }

}
