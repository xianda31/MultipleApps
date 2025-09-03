import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { map, Observable, switchMap, forkJoin } from 'rxjs';
import { FileService } from '../../common/services/files.service';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-album',
  imports: [CommonModule],
  templateUrl: './album.component.html',
  styleUrl: './album.component.scss'
})
export class AlbumComponent {
  album_name!: string;
  photos_url$: Observable<string[]> = new Observable<string[]>();

  constructor(
    private route: ActivatedRoute,
    private fileService: FileService
  ) {

  }

  ngOnInit() {

    this.route.paramMap.subscribe(params => {
      this.album_name = params.get('id')!;
      // You can now use this.album_name in your component
      this.photos_url$ = this.fileService.list_files('images/albums/' + this.album_name + '/').pipe(
        switchMap((S3items) =>
          forkJoin(S3items.map(item => this.fileService.getPresignedUrl(item.path)))
        )
      );
    });

  }
}
