import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FileService, S3_BUCKET, S3_ROOT_FOLDERS } from '../../../common/services/files.service';
import { ThumbnailsService } from '../album-thumbnails/album-thumbnails';

@Component({
  selector: 'app-root-volume',
  imports: [CommonModule],
  templateUrl: './root-volume.html',
  styleUrl: './root-volume.scss'
})
export class RootVolumeComponent {
  volume_name !: string;
  root_folders !: string[];
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private thumbnailsService: ThumbnailsService
  ) { 
    this.volume_name = S3_BUCKET;
    this.root_folders = Object.values(S3_ROOT_FOLDERS);
  }


  select_root_folder(folder: string) {
    this.router.navigate(['../disk', folder], { relativeTo: this.route });
  }

  updateAlbumThumbnail() {
  this.thumbnailsService.process();
  }
}

