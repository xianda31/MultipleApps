import { Component } from '@angular/core';
import { S3Item } from '../../../../../../common/file.interface';
import { getUrl, list } from 'aws-amplify/storage';
import { CommonModule } from '@angular/common';
import { FileService } from '../../../../../../common/services/files.service';
import { Observable } from 'rxjs';
import { ImgUploadComponent } from '../img-upload/img-upload.component';
import { ReplacePipe } from '../../../../../../common/pipes/replace.pipe';


@Component({
  selector: 'app-image-mgr',
  standalone: true,
  imports: [CommonModule, ImgUploadComponent, ReplacePipe],
  templateUrl: './image-mgr.component.html',
  styleUrl: './image-mgr.component.scss'
})
export class ImageMgrComponent {
  S3Items!: S3Item[];

  constructor(
    private fileService: FileService

  ) {
    this.fileService.S3Items.subscribe((items) => {
      this.S3Items = items;
    });

  }
  onDelete(item: S3Item) {
    this.fileService.delete(item.path);
  }

  addItem(event: any) {
    this.fileService.listFiles();
  }
}
