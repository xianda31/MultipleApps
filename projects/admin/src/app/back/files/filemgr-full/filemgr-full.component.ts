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


  window_view_style: boolean = true; // 'mode windows-like';

  directory = '';
  fileSystemNode: FileSystemNode | null = null;
  S3items: S3Item[] = [];

  selected_item: S3Item | null = null;


  current_node !: FileSystemNode;
  node_stack: FileSystemNode[] = [];
  returned_value: any;

  // utilitaires unix-view
  showInputFor: string | null = null;
  openInputs: Set<string> = new Set();
  openFolderInputs: Set<string> = new Set();
  openFileInputs: Set<string> = new Set();
  openImageNodes: Set<string> = new Set();

  imgDimensions: { [key: string]: { width: number, height: number } } = {};




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
      this.fileSystemNode = this.fileService.processStorageList(S3items);
      this.current_node = this.fileSystemNode;
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


  search_folder_node_by_path(path: string): FileSystemNode {
    // recursively search for key in fs

    const search_path = (path: string, fs: FileSystemNode): FileSystemNode | null => {
      const data = fs['__data'] as unknown as S3Item;
      if (data && data.path === path) {
        return fs;
      } else {
        let childs = Object.values(fs) as FileSystemNode[];
        if (!childs) { return null; }
        for (const child of childs) {
          const result = search_path(path, child);
          if (result) {
            return result;
          }
        }
        return null;
      }
    };
    if (!this.fileSystemNode) { throw new Error('File system undefined'); }
    let img_folder = search_path(path, this.fileSystemNode);
    if (!img_folder) {
      throw new Error('No images folder found in S3');
    }
    return img_folder;

  }



  // utilities for file tree navigation




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

  get_size(item: S3Item): number {
    return item.size;
  }

  is_folder(item: S3Item): boolean {
    return item.size === 0;
  }



  add_folder(item: S3Item, folder_name: string) {

    this.S3items.push({
      path: item.path + folder_name,
      size: 0,
    });

    this.current_node = this.set_current_node(this.S3items);
    console.log('current_node after add_folder:', this.current_node);
  }

  click_on_node(key: string, item: S3Item) {
    if (this.window_view_style) {
      if (this.is_folder(item)) {
        this.select_subfolder(key, item);
      } else {
        this.selected_item = item;
      }
    } else {
      if (this.is_folder(item)) {
        item.folded = !item.folded;
        //  needed to trigger change detection
        this.current_node = this.current_node;
      } else {
        this.toggleImage(key);
      }
    }
  }


  add_file(item: S3Item, event: any) {

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

  
  window_regenerate_navigation_point(root: string) {
    this.fileSystemNode = this.fileService.processStorageList(this.S3items);
    if (!this.fileSystemNode) { throw new Error('File system undefined after upload'); }
    this.current_node = this.fileSystemNode;
    // move from root down to parent folder
    this.node_stack = [];
    let folders = this.get_path_segments(root);
    folders = folders.slice(1); // remove first segment as root is current_node
    folders.forEach(folder => {
      const next_node = this.get_sub_node(this.fileSystemNode!, folder);
      if (next_node) {
            this.node_stack.push(this.current_node);
            this.current_node = next_node;
      } else { throw new Error('Folder not found during navigation after upload'); }
    });
  }
  
  window_delete_file(item: S3Item) {
    this.fileService.delete_file(item.path).then(() => {
      this.selected_item = null;
      this.S3items = this.S3items.filter(f => f.path !== item.path);
    
    const parent_path = item.path.split('/').slice(0, -1).join('/') + '/';
        this.window_regenerate_navigation_point(parent_path);
      this.toastService.showSuccess('Suppression', 'Fichier supprimé avec succès');
    }).catch(() => {
      this.toastService.showErrorToast('Suppression', 'Échec de la suppression du fichier');
    });
  }

  windows_add_file(parent: S3Item, event: any) {
    const file = event.target.files[0];
    if (file) {
      this.fileService.upload_file(file, parent.path).then(() => {
        this.S3items.push(
          {
            path: parent.path + file.name,
            size: file.size,
            url: this.presigned_url(parent.path + file.name)
          }
        );
        this.window_regenerate_navigation_point(parent.path);
        this.toastService.showSuccess('Upload', 'Fichier téléchargé avec succès');
      }).catch((error) => {
        this.toastService.showErrorToast('Upload', 'Échec du téléchargement du fichier');
      });
    }
  }

  delete_file(item: S3Item) {

    this.fileService.delete_file(item.path);
    this.S3items = this.S3items.filter(f => f.path !== item.path);
    this.current_node = this.set_current_node(this.S3items);
  }




  // utilities for windows-like display of file tree

  get_path_segments(path: string): string[] {
    const segments = path.split('/').filter(segment => segment.length > 0);
    return segments;
  }

  get_sub_node(fs: FileSystemNode, key: string): FileSystemNode | null {

    const values = Object.values(fs) as FileSystemNode[];
    const fs_entries = values.map(v => Object.entries(v).filter(([k]) => k !== '__data')).flat();
    const entry = fs_entries.find(([k]) => k === key);
    if (entry) {
      return { [key]: entry[1] } as FileSystemNode; // entry[1] is the value
    } else {
      return null;
    }
  }


  select_subfolder(key: string, item: S3Item) {
    if (this.is_folder(item)) {
      const next_node = this.get_sub_node(this.current_node, key);
      if (next_node) {
        this.node_stack.push(this.current_node);
        this.current_node = next_node;
      }
    } else { throw new Error('Item is not a folder'); }
  }

  pop_folder(index: number) {
    if (index < 0 || index >= this.node_stack.length) {
      return;
    }
    this.current_node = this.node_stack[index];
    this.node_stack = this.node_stack.slice(0, index);
  }

  onImgLoad(event: Event, key: string) {
    const img = event.target as HTMLImageElement;
    this.imgDimensions[key] = { width: img.naturalWidth, height: img.naturalHeight };
  }


  // utilities for recursive display of file tree


  toggleImage(nodeKey: string) {
    if (this.openImageNodes.has(nodeKey)) {
      this.openImageNodes.delete(nodeKey);
    } else {
      this.openImageNodes.add(nodeKey);
    }
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

  // utilities for file  upload


  upload_file(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.fileService.upload_file(file, this.directory).then(() => {
        this.S3items.push({
          path: this.directory + file.name,
          size: file.size,
        });
        this.current_node = this.set_current_node(this.S3items);

        // this.files$.update(files => [
        //   ...files,
        //   {
        //     path: this.directory + file.name,
        //     size: file.size,
        //     url: this.presigned_url(this.directory + file.name)
        //   }
        // ]);
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
              this.S3items.push({
                path: this.directory + resized_file.name,
                size: resized_file.size,
                // url: this.presigned_url(this.directory + resized_file.name)
              });
              this.current_node = this.set_current_node(this.S3items);

              this.toastService.showSuccess('Upload', 'Fichier allégé téléchargé avec succès');
              // update signal
              // this.files$.update(files => [
              //   ...files,
              //   {
              //     path: this.directory + resized_file.name,
              //     size: resized_file.size,
              //   }
              // ]);

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




}
