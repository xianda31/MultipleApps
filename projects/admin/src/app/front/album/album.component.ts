import { combineLatest } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { Component, Input } from '@angular/core';
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
export class AlbumComponent {
  private _album?: Snippet;
  @Input()
  set album(a: Snippet | undefined) {
    const prevFolder = this._album?.folder;
    this._album = a;
    const currFolder = this._album?.folder;
    if (!a || !currFolder || currFolder.trim() === '') {
      this.photos = [];
      this.loading = false;
      return;
    }
    // If folder changed (or first set), reload photos
    if (prevFolder !== currFolder) {
      this.loadPhotos();
    }
  }
  get album(): Snippet | undefined { return this._album; }
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
    // se protéger contre un folder vide
    const folder = this._album?.folder;
    if (!folder || folder.trim() === '') {
      this.loading = false;
    } else {
      this.loadPhotos();
    }
  }

  loadPhotos() {
    this.loading = true;
    const folder = this._album?.folder;
    if (!folder) { this.photos = []; this.loading = false; return; }
    this.fileService.list_files(folder + '/').pipe(
      map((S3items) => S3items.filter(item => item.size !== 0)),
      tap((items) => { if (items.length === 0) console.log('Album %s is empty', this._album?.title); }),
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
      ).subscribe((items) => {  this.photos = items; this.loading = false; });
  }

  openCarousel(index:number  ) {
    const id = this._album?.id;
    if (!id) return;
    this.router.navigate(['.', id], { queryParams: { startAt: index, autoWrapped: true }, relativeTo: this.route });
  }
}