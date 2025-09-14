
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileSystemNode, S3Item } from '../../../common/interfaces/file.interface';
import { FileService, S3_BUCKET } from '../../../common/services/files.service';
import { ImageService } from '../../../common/services/image.service';
import { ToastService } from '../../../common/services/toast.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
    selector: 'app-filemgr-windows',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './filemgr-windows.component.html',
    styleUrls: ['./filemgr-windows.component.scss']
})
export class FilemgrWindowsComponent {
    fileSystemNode: FileSystemNode = {};
    S3items: S3Item[] = [];
    selected_item: S3Item | null = null;
    current_node !: FileSystemNode;
   root_folder !: string;
   volume_name !: string;

    node_stack: FileSystemNode[] = [];
    imgDimensions: { [key: string]: { width: number, height: number } } = {};

    constructor(
        private fileService: FileService,
        private toastService: ToastService,
        private imageService: ImageService,
        private route: ActivatedRoute,
            private router: Router,

    ) { 
            this.volume_name = S3_BUCKET;

    }


    ngOnInit() {
        // retrieve root_folder from route param if exists
        const root_folder = this.route.snapshot.paramMap.get('root_folder');

        if (root_folder) {
            this.root_folder = root_folder + '/';
            this.fileService.list_files(this.root_folder).subscribe((S3items) => {
                this.S3items = S3items;
                
                this.fileSystemNode = this.fileService.generate_filesystem(this.S3items);
                if (Object.keys(this.fileSystemNode).length === 0) {
                    this.toastService.showInfo('Aucun fichier', 'Le dossier est vide');
                }else{
                    this.current_node = this.fileSystemNode;
                }
            });
        }
        else{throw new Error('No root_folder parameter in route');}
    }


    regenerate_navigation_point(root_path: string) {

        this.fileSystemNode = this.fileService.generate_filesystem(this.S3items);
        if (!this.fileSystemNode) { throw new Error('File system undefined after upload'); }
        this.current_node = this.fileSystemNode;
        // move from root down to parent folder
        this.node_stack = [];
        let folders = root_path.split('/').filter(Boolean);
        folders = folders.slice(1); // remove first segment as root is current_node
        folders.forEach(folder => {
            const next_node = this.get_sub_node(this.current_node, folder);
            if (next_node) {
                this.node_stack.push(this.current_node);
                this.current_node = next_node;

            } else {
                throw new Error(`'${root_path}' folder not found during navigation after upload`);
            }
        });
    }

    windows_add_folder(parent: S3Item, folder_name: string) {
        if (!folder_name || folder_name.trim() === '') {
            this.toastService.showErrorToast('Nouveau dossier', 'Le nom du dossier ne peut pas être vide');
            return;
        }
        this.create_virtual_folder(parent, folder_name);
    }

    window_delete_file(item: S3Item) {
        this.fileService.delete_file(item.path).then(() => {
            this.selected_item = null;
            this.S3items = this.S3items.filter(f => f.path !== item.path);

            const parent_path = item.path.split('/').slice(0, -1).join('/') + '/';
            this.regenerate_navigation_point(parent_path);
            this.toastService.showSuccess('Suppression', 'Fichier supprimé avec succès');

        }).catch(() => {
            this.toastService.showErrorToast('Suppression', 'Échec de la suppression du fichier');
        });
    }

    async windows_add_file(parent: S3Item, event: any) {
        const files: FileList = event.target.files;
        if (!files) return;
        // Convert FileList to array and iterate
        Array.from(files).forEach((file: File) => {
            this.upload_and_add_file(file, parent.path);
        });
    }

    async add_file_lighten(item: S3Item) {
        const folder = item.path.split('/').slice(0, -1).join('/') + '/';
        this.image_lighter(item).then((file) => {
            this.upload_and_add_file(file, folder).then((lighter_item) => {
                this.toastService.showSuccess('Upload', 'Fichier allégé créé et téléchargé avec succès');
                this.selected_item = lighter_item;
            });
        });
    }

    create_virtual_folder(parent: S3Item, folder_name: string) {
        const newItem: S3Item = {
                path:  parent.path + folder_name + '/',
                size: 0,
            };
            this.S3items.push(newItem);
            this.regenerate_navigation_point(parent.path);
    }

    upload_and_add_file(file: File, path: string): Promise<S3Item> {
        return this.fileService.upload_file(file, path).then(() => {
            const newItem: S3Item = {
                path: path + file.name,
                size: file.size,
                url$: this.fileService.getPresignedUrl$(path + file.name)
            };
            this.S3items.push(newItem);
            this.regenerate_navigation_point(path);
            return newItem;
        }).catch((error) => {
            this.toastService.showErrorToast('Upload', 'Échec du téléchargement du fichier');
            return Promise.reject(error);
        });
    }





    get_icon(item: S3Item | null): string {
        if (!item) {
            return 'bi-question-square';
        }
        if (item.size === 0) {
            return 'bi bi-folder text-success';
        }
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

    get current_node_data(): S3Item {
        const values = Object.values(this.current_node) as FileSystemNode[];
        const data = values.find(v => v['__data'])?.['__data'] as unknown as S3Item;
        if (!data) { throw new Error('No __data in current_node'); }
        return data;
    }


    pop_folder(index: number) {
        if (index < 0 || index >= this.node_stack.length) {
            return;
        }
        this.current_node = this.node_stack[index];
        this.node_stack = this.node_stack.slice(0, index);
    }

    is_folder(item: S3Item): boolean {
        return item.size === 0;
    }

    back_to_volume() {
        
        this.router.navigate(['back/site/disk']);
    }

    click_on_node(key: string, data: S3Item) {

        if (this.is_folder(data)) {
            const next_node = this.get_sub_node(this.current_node, key);
            if (next_node) {
                this.node_stack.push(this.current_node);
                this.current_node = next_node;
            } else { throw new Error('Isub-node not found !!'); }
        } else {
            this.selected_item = data;
        }
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


    // Utilities for image processing

    
    onImgLoad(event: Event, key: string) {
        const img = event.target as HTMLImageElement;
        this.imgDimensions[key] = { width: img.naturalWidth, height: img.naturalHeight };
    }
    
    image_lighter(file: S3Item): Promise<File> {
        
        const add_wh = (path: string, wh: string): string => {
            const newFilename = path.replace('.', `_${wh}.`);
            return newFilename;
        }

        const get_filename = (path: string): string => {
            const parts = path.split('/');
            return parts.pop() || '';
        }

        return new Promise((resolve, reject) => {
            this.fileService.download_file(file.path).then((blob) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = reader.result as string;
                    this.imageService.resizeBase64Image(base64,true).then((resizedBase64) => {
                        this.imageService.getBase64Dimensions(resizedBase64).then((dimensions) => {
                            const wh = dimensions.width.toString() + 'x' + dimensions.height.toString();
                            let new_blob = this.imageService.base64ToBlob(resizedBase64);

                            let resized_file = new File([new_blob], add_wh(get_filename(file.path), wh), { type: new_blob.type });
                            resolve(resized_file)
                        });
                    });
                };
                reader.readAsDataURL(blob);
            });
        });
    }
}
