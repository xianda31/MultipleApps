import { Component, Input, signal, WritableSignal } from '@angular/core';
import { FileService } from '../../../common/services/files.service';
import { FileSystemNode, S3Item } from '../../../common/interfaces/file.interface';
import { CommonModule } from '@angular/common';
import { catchError, map, Observable, of } from 'rxjs';
import { ToastService } from '../../../common/services/toast.service';
import { ImageService } from '../../../common/services/image.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-filemgr-full',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './filemgr-full.component.html',
  styleUrl: './filemgr-full.component.scss'
})
export class FilemgrFullComponent {
  @Input() type: 'documents' | 'albums' | 'vignettes' = 'albums';

  directory = '';
  fileSystemNode: FileSystemNode | null = null;
  S3items: S3Item[] = [];



  current_node !: FileSystemNode;
  node_stack: FileSystemNode[] = [];
  returned_value: any;


  files$: WritableSignal<S3Item[]> = signal<S3Item[]>([]);
  showInputFor: string | null = null;
  openInputs: Set<string> = new Set();
  openFolderInputs: Set<string> = new Set();
  openFileInputs: Set<string> = new Set();
  openImageNodes: Set<string> = new Set();



  constructor(
    private fileService: FileService,
    private toastService: ToastService,
    private imageService: ImageService,
  ) { }

  ngOnInit() {

    this.directory = this.type === 'documents' ? 'documents/' : this.type === 'albums' ? 'images/albums/' : 'images/vignettes/';

    switch (this.type) {
      case 'albums':
        this.directory = 'images/';
        break;
      case 'documents':
        this.directory = 'documents/';
        break;
      case 'vignettes':
        this.directory = 'images/vignettes/';
        break;
      default:
        throw new Error('Invalid type for FilemgrFullComponent');
    }
    this.fileService.list_files(this.directory).pipe(
    ).subscribe((S3items) => {
      this.S3items = S3items;
      this.current_node = this.set_current_node(S3items);
    });


  }

  set_current_node(S3items: S3Item[]): FileSystemNode {
    this.fileSystemNode = this.fileService.processStorageList(S3items);
    // initialize current_node to 'images' folder
    const img_folder = this.get_sub_node(this.fileSystemNode, 'images');
    if (!img_folder) { throw new Error('No images folder found in S3'); }
    console.log('images loaded:', img_folder);
    return img_folder;

  }

  // utilities for file tree navigation

  get_sub_node(fs: FileSystemNode, key: string): FileSystemNode | null {
    const childs = Object.keys(fs);
    if (childs.includes(key)) {
      return { [key]: fs[key] } as FileSystemNode;
    }
    return null;
  }


  // Helper to check if a node is a file (has __data)
  isFileNode(node: any): node is { __data: S3Item } {
    return node && typeof node === 'object' && '__data' in node;
  }

  get__data(node: any): S3Item | null {
    if (this.isFileNode(node)) {
      return node.__data;
    }
    return null;
  }



  get_icon(item: S3Item | null): string {
    if (!item) {
      return 'bi-question-square'; // Default icon for folders or unknown
    }
    if (item.size === 0) {
      return 'bi bi-folder text-success';
    }
    // select upon file type
    const fileType = item.path.split('.').pop();
    switch (fileType) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return 'bi bi-file-image text-info';
      case 'pdf':
        return 'bi bi-file-earmark-pdf text-info';
      case 'doc':
      case 'docx':
        return 'bi bi-file-earmark-word text-info';
      default:
        return 'bi bi-file text-danger';
    }
  }

  get_size(item: S3Item ): number {
    return item.size;
  }

  is_folder(item: S3Item ): boolean {
    return item.size === 0;
  }

  click_on_node(key:string, item: S3Item ) {
   
    if (this.is_folder(item)) {
      item.folded = !item.folded;
      //  needed to trigger change detection
      this.current_node = this.current_node;
    } else {
      this.toggleImage(key);
    }
  }

    toggleImage(nodeKey: string) {
    if (this.openImageNodes.has(nodeKey)) {
      this.openImageNodes.delete(nodeKey);
    } else {
      this.openImageNodes.add(nodeKey);
    }
  }


  add_folder(item: S3Item , folder_name: string) {

    this.S3items.push({
      path: item.path + folder_name,
      size: 0,
    });

    this.current_node = this.set_current_node(this.S3items);
    console.log('current_node after add_folder:', this.current_node);
  }

  add_file(item: S3Item , event: any) {

    const file = event.target.files[0];
    if (file) {
      this.fileService.upload_file(file, item.path).then(() => {
        this.S3items.push(
          {
            path: item.path + file.name,
            size: file.size,
            // url: this.presigned_url(item.path + file.name)
          }
        );
        this.toastService.showSuccess('Upload', 'Fichier téléchargé avec succès');
        this.current_node = this.set_current_node(this.S3items);

      }).catch((error) => {
        this.toastService.showErrorToast('Upload', 'Échec du téléchargement du fichier');
      });
    }
  }

  delete_file(item: S3Item ) {

    this.S3items = this.S3items.filter(f => f.path !== item.path);
    this.current_node = this.set_current_node(this.S3items);
    this.fileService.delete_file(item.path);
  }

  // utilities for file listing and upload

  // delete_file(file: S3Item) {
  //   this.files$.update(files => files.filter(f => f.path !== file.path));
  //   this.fileService.delete_file(file.path);
  // }



  upload_file(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.fileService.upload_file(file, this.directory).then(() => {
        this.files$.update(files => [
          ...files,
          {
            path: this.directory + file.name,
            size: file.size,
            url: this.presigned_url(this.directory + file.name)
          }
        ]);
        this.toastService.showSuccess('Upload', 'Fichier téléchargé avec succès');
      }).catch((error) => {
        this.toastService.showErrorToast('Upload', 'Échec du téléchargement du fichier');
      });
    }
  }

  presigned_url(image_path: string): Observable<string> {
    return (this.fileService.getPresignedUrl(image_path)).pipe(
      map((url: string) => {
        return url;
      }),
      catchError(err => {
        console.error('Error fetching presigned URL:', err);
        return of('bcsto_ffb.jpg');
      })
    );
  }

  image_process(file: S3Item) {
    this.fileService.download_file(file.path).then((blob) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        this.imageService.resizeImage(base64).then((resizedBase64) => {
          // console.log('Image resized:', resizedBase64);
          this.imageService.getBase64Dimensions(resizedBase64).then((dimensions) => {
            const wh = dimensions.width.toString() + 'x' + dimensions.height.toString();
            let new_blob = this.imageService.base64ToBlob(resizedBase64);

            let resized_file = new File([new_blob], this.add_wh(this.get_filename(file.path), wh), { type: new_blob.type });
            this.fileService.upload_file(resized_file, this.directory).then(() => {
              this.files$.update(files => [
                ...files,
                {
                  path: this.directory + resized_file.name,
                  size: resized_file.size,
                  url: this.presigned_url(this.directory + resized_file.name)
                }
              ]);

            });
          });
        });
      };
      reader.readAsDataURL(blob);
    });
  }

  get_filename(path: string): string {
    const parts = path.split('/');
    return parts.pop() || '';
  }

  add_wh(path: string, wh: string): string {
    const newFilename = path.replace('.', `_${wh}.`);
    return newFilename;
  }

  toggleInput(folderKey: string) {
    if (this.openInputs.has(folderKey)) {
      this.openInputs.delete(folderKey);
    } else {
      this.openInputs.add(folderKey);
    }
  }

  toggleFolderInput(folderKey: string) {
    if (this.openFolderInputs.has(folderKey)) {
      this.openFolderInputs.delete(folderKey);
    } else {
      this.openFolderInputs.add(folderKey);
    }
  }

  toggleFileInput(folderKey: string) {
    if (this.openFileInputs.has(folderKey)) {
      this.openFileInputs.delete(folderKey);
    } else {
      this.openFileInputs.add(folderKey);
    }
  }


}
