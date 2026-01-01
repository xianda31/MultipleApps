
import { combineLatest, of } from 'rxjs';
import { map, switchMap, tap, catchError } from 'rxjs/operators';
import { Component, Input, OnChanges, SimpleChanges, ChangeDetectorRef, ViewChild, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FileService, S3_ROOT_FOLDERS } from '../../common/services/files.service';
import { SystemDataService } from '../../common/services/system-data.service';
import { CommonModule } from '@angular/common';
import { NgbCarouselModule, NgbCarousel } from '@ng-bootstrap/ng-bootstrap';
import { S3Item } from '../../common/interfaces/file.interface';
import { Snippet } from '../../common/interfaces/page_snippet.interface';
import { SnippetService } from '../../common/services/snippet.service';
import { TitleService } from '../title/title.service';


// Extend S3Item to allow highResUrl for template type safety
type AlbumPhoto = S3Item & { highResUrl?: string };

@Component({
  selector: 'app-album',
  standalone: true,
  imports: [CommonModule, NgbCarouselModule],
  templateUrl: './album.component.html',
  styleUrl: './album.component.scss'
})
export class AlbumComponent implements OnChanges, OnInit {
  @Input() album_id?: string;
  @ViewChild(NgbCarousel) carousel!: NgbCarousel;
  private lastLoadedFolder?: string;
  photos: AlbumPhoto[] = [];
  album!: Snippet;
  loading = true;
  activeId: string = '0';
  carouselInterval = 0;

  constructor(
    private fileService: FileService,
    private systemDataService: SystemDataService,
    private snippetService: SnippetService,
    private route: ActivatedRoute,
    private titleService: TitleService
  ) {
    this.systemDataService.get_ui_settings().subscribe(ui => {
      if (ui && typeof ui['album_carousel_interval_ms'] === 'number') {
        this.carouselInterval = ui['album_carousel_interval_ms'];
      } else {
        this.carouselInterval = 3000;
      }
    });
  }

  ngOnInit() {
    const routeSnippetId = this.route.snapshot.paramMap.get('snippet_id');
    if (routeSnippetId) {
      this.album_id = routeSnippetId;
    }
    this.checkAndLoadPhotos();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['album_id'] && this.album_id) {
      this.checkAndLoadPhotos();
    }
  }

  private async loadAlbum() {
    if (!this.album_id) {
      console.warn('Album ID not provided');
      return;
    }
    const album = await this.snippetService.readSnippet(this.album_id);
    if (!album) { console.warn('Album not found: ', this.album_id); return; }
    this.album = album;
    this.titleService.setTitle(album.title + ' - ' + album.subtitle);
  }

  private async  checkAndLoadPhotos() {
    if (!this.album_id) {
      console.warn('Album ID not provided');
      return;
    }
    
    await this.loadAlbum();
    
    const folder = this.album.folder;
    if (!folder || folder.trim() === '') {
      this.photos = [];
      this.loading = false;
      this.lastLoadedFolder = undefined;
      return;
    }
    if (folder !== this.lastLoadedFolder) {
      this.lastLoadedFolder = folder;
      this.loadPhotos(this.album);
    }
  }
  onActiveIdChange(newId: any) {
    this.activeId = String(newId);
  }


  getThumbnailUrl(originalUrl: string): string {
    return S3_ROOT_FOLDERS.THUMBNAILS + '/' + originalUrl;
  }


  loadPhotos(album: Snippet) {
    this.loading = true;
    const folder = album?.folder;
    if (!folder) {
      this.photos = [];
      this.loading = false;
      return;
    }
    this.fileService
      .list_files(folder + '/')
      .pipe(
        map((S3items) => S3items.filter((item) => item.size !== 0)),
        tap((items) => {
          if (items.length === 0) console.log('Album %s is empty',album?.title);
        }),
        switchMap((S3items) => {
          if (!S3items.length) return of(S3items);
          // For each item, fetch both thumbnail and high-res URLs
          return combineLatest(
            S3items.map((item) =>
              combineLatest([
                this.fileService.getPresignedUrl$(this.getThumbnailUrl(item.path)).pipe(catchError(() => of(undefined))),
                this.fileService.getPresignedUrl$(item.path).pipe(catchError(() => of(undefined)))
              ]).pipe(
                map(([thumbUrl, highResUrl]) => {
                  return { ...item, url: thumbUrl, highResUrl };
                })
              )
            )
          );
        }),
        catchError((err: any) => {
          // 404 or other error: fallback to empty
          console.warn("Erreur lors du chargement des photos de l'album", err);
          this.photos = [];
          this.loading = false;
          return of([] as S3Item[]);
        })
      )
      .subscribe((items: AlbumPhoto[]) => {
        this.photos = items;
        this.loading = false;
        if (items.length > 0) {
          this.activeId = '0';
        }
      });
  }

  selectSlide(index: number) {
    if (this.carousel) {
      this.carousel.select(index.toString());
    }
  }

  async download(photo: AlbumPhoto) {
    if (!photo.highResUrl) return;
    try {
      const response = await fetch(photo.highResUrl);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      // Extract filename from path
      const segments = photo.path.split('/');
      link.download = segments[segments.length - 1] || 'image.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.warn('Download failed', err);
    }
  }
}