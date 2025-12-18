import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FileService, S3_ROOT_FOLDERS } from '../../../common/services/files.service';
import { ImgService } from '../../../common/services/img.service';
import { ToastService } from '../../../common/services/toast.service';
import { FileSystemSelectorComponent } from '../../pages/file-system-selector/file-system-selector.component';
import { SystemDataService } from '../../../common/services/system-data.service';
import { ImageSize } from '../../../common/interfaces/ui-conf.interface';

@Component({
  selector: 'app-uploader',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './uploader.html',
  styleUrls: ['./uploader.scss']
})
export class UploaderComponent {
  // --- UI & état ---
  targetRoot: string = S3_ROOT_FOLDERS.IMAGES;
  S3_ROOT_FOLDERS = S3_ROOT_FOLDERS;
  data_usage!: Record<S3_ROOT_FOLDERS, string[]>;
  filesByRoot: { [key: string]: File[] } = {};
  previewImagesByRoot: { [key: string]: string[] } = {};
  previewLighterImagesByRoot: { [key: string]: string[] } = {};
  previewImagesMetaByRoot: { [key: string]: Array<{ width: number, height: number, sizeKB: number, selected: boolean }> } = {};
  previewLighterImagesMetaByRoot: { [key: string]: Array<{ width: number, height: number, sizeKB: number, selected: boolean }> } = {};
  targetFolderByRoot: { [key: string]: string } = {};
  uploading = false;
  uploadedItems: Array<{ path: string; size: number; url?: string }> = [];
  card_img_sizes: ImageSize[] = [];

  constructor(
    private modal: NgbModal,
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
          'nota : les images originales sont conservées telles quelles ; à utiliser pour le carousel d\'accueil par exemple.'
        ],
        [S3_ROOT_FOLDERS.ALBUMS]: [
          'Photos en haute résolution (jpg, png), format et résolution originaux, pour les albums photos',
          'nota : des vignettes pour le preview des dossiers albums sont générées automatiquement.'
        ],
        [S3_ROOT_FOLDERS.DOCUMENTS]: [
          'Documents (pdf, doc, docx) en accès public ou privé',
          'utilisés pour les téléchargements par les visiteurs du site.'
        ],
        [S3_ROOT_FOLDERS.PORTRAITS]: [],
        [S3_ROOT_FOLDERS.THUMBNAILS]: []
      };
    });
  }


  chooseFolder(root?: string) {
    const prevRoot = this.targetRoot;
    if (root) this.targetRoot = root;
    const modalRef = this.modal.open(FileSystemSelectorComponent as any, { size: 'lg', centered: true });
    const cmp = modalRef.componentInstance as any;
    cmp.rootFolder = this.targetRoot + '/';
    // allow creating folders from the uploader
    cmp.allowCreateFolder = true;
    cmp.mode = 'folders';
    const sub = cmp.select?.subscribe((path: string) => {
      // ensure trailing slash
      const p = path.endsWith('/') ? path : path + '/';
      this.targetFolderByRoot[this.targetRoot] = p;
      modalRef.close();
    });
    cmp.close?.subscribe(() => modalRef.close());
    modalRef.result.finally(() => {
      sub?.unsubscribe?.();
      this.targetRoot = prevRoot;
      // Focus sur le bouton 'Choisir des fichiers' après fermeture de la modale
      setTimeout(() => {
        const btn = document.querySelector('button[title="Choisir des fichiers"]') as HTMLButtonElement;
        if (btn) btn.focus();
      }, 0);
    });
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
        }
      }
      this.previewLighterImagesByRoot[key] = lighterUrls;
      this.previewLighterImagesMetaByRoot[key] = lighterMetas;
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
    const tf = this.targetFolderByRoot[key] ?? '';
    let files = this.filesByRoot[key] ?? [];
    // Filtre les fichiers originaux selon la sélection
    const metaArr = this.previewImagesMetaByRoot[key];
    let selectedCount = files.length;
    if (metaArr && metaArr.length === files.length) {
      files = files.filter((_, i) => metaArr[i]?.selected);
      selectedCount = metaArr.filter(m => m.selected).length;
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
    if (selectedCount === 0) {
      this.toast.showWarning('Uploader', 'Aucun fichier sélectionné');
      return;
    }
    this.uploading = true;
    try {
      for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
        const f = files[fileIdx];
        await this.fileService.upload_file(f, tf);
        const path = tf + f.name;
        let url: string | undefined = undefined;
        try {
          url = await this.fileService.getPresignedUrl$(path).toPromise();
        } catch {}
        this.uploadedItems.push({ path, size: f.size, url });
        // Génère et upload les images allégées pour IMAGES et ALBUMS
        const currentRoot = (root ?? this.targetRoot);
        if (currentRoot === S3_ROOT_FOLDERS.IMAGES || currentRoot === S3_ROOT_FOLDERS.ALBUMS) {
          const lighterFiles = await this.imgService.createLighterFiles(f, this.card_img_sizes);
          let lighterMetaArr = this.previewLighterImagesMetaByRoot[key];
          if (lighterMetaArr && lighterMetaArr.length > 0) {
            const filteredLighterFiles = lighterFiles.filter((_, i) => lighterMetaArr[i]?.selected);
            for (let i = 0; i < filteredLighterFiles.length; i++) {
              const { file: lighterFile, size } = filteredLighterFiles[i];
              // Pour ALBUMS, upload dans THUMBNAILS, en gardant le même chemin relatif et le nom original (pas de suffixe)
              let lighterTargetFolder = tf;
              let lighterFileToUpload = lighterFile;
              let lighterFileName = lighterFile.name;
              if (currentRoot === S3_ROOT_FOLDERS.ALBUMS) {
                // tf commence par le chemin sélectionné sous ALBUMS, il faut le remplacer par THUMBNAILS/albums/
                // Ex: tf = 'albums/2025/vacances/' => lighterTargetFolder = 'thumbnails/albums/2025/vacances/'
                const albumsPrefix = S3_ROOT_FOLDERS.ALBUMS + '/';
                const thumbnailsPrefix = S3_ROOT_FOLDERS.THUMBNAILS + '/albums/';
                if (tf.startsWith(albumsPrefix)) {
                  lighterTargetFolder = thumbnailsPrefix + tf.substring(albumsPrefix.length);
                } else {
                  // fallback: just replace root
                  lighterTargetFolder = tf.replace(S3_ROOT_FOLDERS.ALBUMS, S3_ROOT_FOLDERS.THUMBNAILS+ '/albums/');
                }
                // Renommer le fichier allégé pour qu'il ait le même nom que l'original
                lighterFileName = f.name;
                // Créer un nouveau File avec le nom original si besoin
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
              this.toast.showSuccess('Uploader', `Image allégée (${size.width}x${size.height}) créée et téléchargée avec succès`);
            }
          }
        }
      }
      this.toast.showSuccess('Uploader', 'Fichiers téléchargés avec succès');
      this.filesByRoot[key] = [];
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
