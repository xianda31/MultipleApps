import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FileService, S3_BUCKET, S3_ROOT_FOLDERS } from '../../../common/services/files.service';
import { ThumbnailsService } from '../album-thumbnails/thumbnails.service';
import { ToastService } from '../../../common/services/toast.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root-volume',
  imports: [CommonModule,FormsModule],
  templateUrl: './root-volume.html',
  styleUrl: './root-volume.scss'
})
export class RootVolumeComponent {
  volume_name !: string;
  root_folders !: string[];
  progress : number = 0;
  showThumbnails: boolean = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private thumbnailsService: ThumbnailsService,
        private toastService: ToastService

  ) {
    this.volume_name = S3_BUCKET;
    this.root_folders = Object.values(S3_ROOT_FOLDERS)
      .filter(folder => folder !== S3_ROOT_FOLDERS.THUMBNAILS); // mask thumbnails folder
  }

toggleThumbnails() {
    this.showThumbnails = !this.showThumbnails;
    if (this.showThumbnails) {
      this.root_folders = Object.values(S3_ROOT_FOLDERS);
    } else {
      this.root_folders = Object.values(S3_ROOT_FOLDERS)
        .filter(folder => folder !== S3_ROOT_FOLDERS.THUMBNAILS); // mask thumbnails folder
    }
  }

  select_root_folder(folder: string) {
    this.router.navigate(['../disk', folder], { relativeTo: this.route });
  }

  updateAlbumThumbnail() {
    this.thumbnailsService.process();
    
    this.toastService.showInfo('Albums' ,'Regéneration des vignettes démarrée...');
    this.thumbnailsService.progress$.subscribe(progress => {
      this.progress = progress;
      if(progress === 100){
      // wait 1 second before clearing progress
      setTimeout(() => {
        this.progress = 0;
      }, 1000);
      this.toastService.showSuccess('Albums', 'Regéneration des vignettes terminée');
      }
    });
  }
}
