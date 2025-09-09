import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FilemgrWindowsComponent } from './filemgr-windows.component';
import { FilemgrRecursiveComponent } from './filemgr-recursive.component';
import { FileService } from '../../../common/services/files.service';
import { FileSystemNode, S3Item } from '../../../common/interfaces/file.interface';
import { ToastService } from '../../../common/services/toast.service';
import { ImageService } from '../../../common/services/image.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-filemgr-wrapper',
  standalone: true,
  imports: [CommonModule, FormsModule, FilemgrWindowsComponent, FilemgrRecursiveComponent],
  templateUrl: './filemgr-wrapper.component.html',
  // styleUrls: ['./filemgr-wrapper.component.scss']
})
export class FilemgrWrapperComponent implements OnInit {
  viewStyle: 'windows' | 'Arborescence' = 'windows';
  type: 'documents' | 'albums' | 'vignettes' = 'albums';
  directory = '';
  S3items: S3Item[] = [];
  fileSystemNode: FileSystemNode | null = null;
  current_node!: FileSystemNode;
  node_stack: FileSystemNode[] = [];
  selected_item: S3Item | null = null;

  constructor(
    private fileService: FileService,
    private toastService: ToastService,
    private imageService: ImageService,
  ) {}

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
        throw new Error('Invalid type for FilemgrWrapperComponent');
    }
    this.fileService.list_files(this.directory).pipe().subscribe((S3items) => {
      this.S3items = S3items;
      this.fileSystemNode = this.fileService.processStorageList(S3items);
      this.current_node = this.fileSystemNode!;
    });
  }
}
