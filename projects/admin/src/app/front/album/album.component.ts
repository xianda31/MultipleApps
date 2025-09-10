import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { map, Observable, switchMap, forkJoin, tap } from 'rxjs';
import { FileService } from '../../common/services/files.service';
import { CommonModule } from '@angular/common';
import { SiteLayoutService } from '../../common/services/site-layout.service';


@Component({
  selector: 'app-album',
  imports: [CommonModule],
  templateUrl: './album.component.html',
  styleUrl: './album.component.scss'
})
export class AlbumComponent {
  album_path!: string;
  photos_url$: Observable<string[]> = new Observable<string[]>();

  constructor(
    private route: ActivatedRoute,
    private fileService: FileService,
    private siteLayoutService: SiteLayoutService
  ) {}

  ngOnInit() {
    const albums_path = this.siteLayoutService.albums_path;

    this.route.paramMap.subscribe(params => {
      // For multi-segment path, Angular provides the full path as a string
      this.album_path = params.get('path')!;

      // If you want to split into segments: const segments = this.album_path.split('/');
      this.photos_url$ = this.fileService.list_files(albums_path + this.album_path + '/').pipe(
        map((S3items) => S3items.filter(item => item.size !== 0)),
        switchMap((S3items) =>
          forkJoin(S3items.map(item => item.url = this.fileService.getPresignedUrl(item.path)))
        )
      );
    });
  }
}
