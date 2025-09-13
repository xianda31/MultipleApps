

import { Component, Input } from '@angular/core';
import { map, Observable } from 'rxjs';
import { FileService } from '../../common/services/files.service';
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
    // Adapt this replacement to your S3 structure
    return originalUrl.replace('/albums/', '/thumbnails/');
  }

  constructor(
    private fileService: FileService,
    private route : Router
  ) { }

  ngOnInit() {
    this.photos$ = this.fileService.list_files(this.album.folder + '/').pipe(
      map((S3items) => S3items.filter(item => item.size !== 0)),
      map((S3items) => (S3items.map(item => ({ ...item, url: this.fileService.getPresignedUrl(item.path) })))
      )
    );
  }

  openCarousel() {
    this.route.navigate(['/front/albums', this.album.id]);
  }
}
