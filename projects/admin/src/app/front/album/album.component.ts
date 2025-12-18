import { combineLatest, of } from 'rxjs';
import { map, switchMap, tap, catchError } from 'rxjs/operators';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { FileService, S3_ROOT_FOLDERS } from '../../common/services/files.service';
import { CommonModule } from '@angular/common';
import { NgbCarouselModule } from '@ng-bootstrap/ng-bootstrap';
import { S3Item } from '../../common/interfaces/file.interface';
import { Snippet } from '../../common/interfaces/page_snippet.interface';
import { ActivatedRoute, Router } from '@angular/router';


@Component({
  selector: 'app-album',
  standalone: true,
  imports: [CommonModule, NgbCarouselModule],
  templateUrl: './album.component.html',
  styleUrl: './album.component.scss'
})
export class AlbumComponent implements OnChanges {
  @Input() album?: Snippet;
  private lastLoadedFolder?: string;
  photos!: S3Item[] ;
  loading = true;

  getThumbnailUrl(originalUrl: string): string {
    return    S3_ROOT_FOLDERS.THUMBNAILS + '/' + originalUrl;
  }

  constructor(
    private fileService: FileService,
    private router: Router,
    private route : ActivatedRoute
  ) { }

  ngOnInit() {
    this.checkAndLoadPhotos();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['album']) {
      this.checkAndLoadPhotos();
    }
  }

  private checkAndLoadPhotos() {
    const folder = this.album?.folder;
    if (!folder || folder.trim() === '') {
      this.photos = [];
      this.loading = false;
      this.lastLoadedFolder = undefined;
      return;
    }
    if (folder !== this.lastLoadedFolder) {
      this.lastLoadedFolder = folder;
      this.loadPhotos();
    }
  }

  loadPhotos() {
    this.loading = true;
    const folder = this.album?.folder;
    if (!folder) { this.photos = []; this.loading = false; return; }
    this.fileService.list_files(folder + '/').pipe(
      map((S3items) => S3items.filter(item => item.size !== 0)),
      tap((items) => { if (items.length === 0) console.log('Album %s is empty', this.album?.title); }),
      switchMap((S3items) => {
        if (!S3items.length) return of(S3items);
        return combineLatest(
            S3items.map(item => this.fileService.getPresignedUrl$(this.getThumbnailUrl(item.path)).pipe(
              catchError(() => of(undefined))
            ))
          ).pipe(
            map((urls: (string | undefined)[]) => {
              S3items.forEach((item, index) => {
                item.url = urls[index];
              });
              return S3items;
            })
          );
      }),
      catchError((err: any) => {
        // 404 or other error: fallback to empty
        console.warn('Erreur lors du chargement des photos de l\'album', err);
        this.photos = [];
        this.loading = false;
        return of([] as S3Item[]);
      })
    )
    .subscribe((items: S3Item[]) => {  this.photos = items; this.loading = false; });
  }

  openCarousel(index:number  ) {
    const id = this.album?.id;
    if (!id) return;
    this.router.navigate(['.', id], { queryParams: { startAt: index, autoWrapped: true }, relativeTo: this.route });
  }
}