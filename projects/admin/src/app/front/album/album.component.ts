import { combineLatest } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { Component, Input } from '@angular/core';
import {  Observable } from 'rxjs';
import { FileService, S3_ROOT_FOLDERS } from '../../common/services/files.service';
import { CommonModule } from '@angular/common';
import { NgbCarouselModule } from '@ng-bootstrap/ng-bootstrap';
import { S3Item } from '../../common/interfaces/file.interface';
import { Snippet } from '../../common/interfaces/page_snippet.interface';
import { Router } from '@angular/router';


@Component({
  selector: 'app-album',
  imports: [CommonModule, NgbCarouselModule],
  templateUrl: './album.component.html',
  styleUrl: './album.component.scss'
})
export class AlbumComponent {
  @Input() album!: Snippet;
  photos$: Observable<S3Item[]> = new Observable<S3Item[]>();

  getThumbnailUrl(originalUrl: string): string {
    return    S3_ROOT_FOLDERS.THUMBNAILS + '/' + originalUrl;
  }

  constructor(
    private fileService: FileService,
    private route: Router
  ) { }

  ngOnInit() {

    this.photos$ = this.fileService.list_files(this.album.folder + '/').pipe(
      map((S3items) => S3items.filter(item => item.size !== 0)),
      tap((items) => {if(items.length === 0) console.log('Album %s is empty', this.album.title);}),
      switchMap((S3items) => {
        return combineLatest(
          S3items.map(item => this.fileService.getPresignedUrl$(this.getThumbnailUrl(item.path)))
        ).pipe(
          map(urls => {
            S3items.forEach((item, index) => {
              item.url = (urls[index]); 
            });
            return S3items;
          }),
        );
      })
    );
  }

  openCarousel(index:number  ) {
    this.route.navigate(['/front/albums', this.album.id, { startAt: index }]);
  }
}
