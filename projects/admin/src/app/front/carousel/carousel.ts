
import { Component } from '@angular/core';
import { firstValueFrom, map, Observable } from 'rxjs';
import { FileService } from '../../common/services/files.service';
import { CommonModule } from '@angular/common';
import { NgbCarouselModule } from '@ng-bootstrap/ng-bootstrap';
import { S3Item } from '../../common/interfaces/file.interface';
import { ActivatedRoute } from '@angular/router';
import { SnippetService } from '../../common/services/snippet.service';
import { Snippet } from '../../common/interfaces/page_snippet.interface';
import { TitleService } from '../title/title.service';


@Component({
  selector: 'app-carousel',
  imports: [CommonModule, NgbCarouselModule],
  templateUrl: './carousel.html',
  styleUrl: './carousel.scss'
})
export class Carousel {
  album!: Snippet;
  photos$: Observable<S3Item[]> = new Observable<S3Item[]>();
  photoIndex: number = 0;
  autoWrapped: boolean = false


  constructor(
    private fileService: FileService,
    private route: ActivatedRoute,
    private snippetService: SnippetService,
    private titleService: TitleService
  ) { }

  ngOnInit() {
    // Retrieve snippet_id and viewing parameters
    this.route.paramMap.subscribe(params => {
      this.photoIndex = +params.get('startAt')!;
      this.autoWrapped = params.get('autoWrapped') !== null ? params.get('autoWrapped') === 'true' : true;
      const snippet_id = params.get('snippet_id');
      
      if (snippet_id) {
        this.snippetService.listSnippets().subscribe((snippets) => {
          const snippet = snippets.find(s => s.id === snippet_id);

        if (snippet) {
          this.album = snippet;
          this.titleService.setTitle(this.album.title + ' - ' + this.album.subtitle);

          this.photos$ = this.fileService.list_files(this.album.folder + '/').pipe(
            map((S3items) => S3items.filter(item => item.size !== 0)),
          );
        }
      });
      }
    });
  }

  download(photo: S3Item) {
    
    const get_name = (path: string): string => {
      const segments = path.split('/');
      return segments[segments.length - 1];
    };

    firstValueFrom(this.fileService.getPresignedUrl$(photo.path)).then(async (url) => {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = get_name(photo.path);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    });
  }
}
