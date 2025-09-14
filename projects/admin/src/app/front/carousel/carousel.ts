
import { Component, Input } from '@angular/core';
import { map, Observable } from 'rxjs';
import { FileService } from '../../common/services/files.service';
import { CommonModule } from '@angular/common';
import { NgbCarouselModule } from '@ng-bootstrap/ng-bootstrap';
import { S3Item } from '../../common/interfaces/file.interface';
import { ActivatedRoute } from '@angular/router';
import { SnippetService } from '../../common/services/snippet.service';
import { Snippet } from '../../common/interfaces/page_snippet.interface';
import { TitleService } from '../title.service';
import { BackComponent } from "../../common/loc-back/loc-back.component";


@Component({
  selector: 'app-carousel',
  imports: [CommonModule, NgbCarouselModule, BackComponent],
  templateUrl: './carousel.html',
  styleUrl: './carousel.scss'
})
export class Carousel {
  album!: Snippet;
  photos$: Observable<S3Item[]> = new Observable<S3Item[]>();
  photoIndex: number = 0;


  constructor(
    private fileService: FileService,
    private route: ActivatedRoute,
    private snippetService: SnippetService,
    private titleService: TitleService
  ) { }

  ngOnInit() {
    // Retrieve album_path from route parameters
    this.route.paramMap.subscribe(params => {
      this.photoIndex = +params.get('startAt')!;
      const snippet_id = params.get('snippet_id');
      if (snippet_id) {
        this.snippetService.listSnippets().subscribe((snippets) => {
          const snippet = snippets.find(s => s.id === snippet_id);

        if (snippet) {
          this.album = snippet;
          this.titleService.setTitle(this.album.title);
          this.photos$ = this.fileService.list_files(this.album.folder + '/').pipe(
            map((S3items) => S3items.filter(item => item.size !== 0)),
            // map((S3items) => S3items.map(item => ({ ...item, url: this.fileService.getPresignedUrl$(item.path) })))
          );
        }
      });
      }
    });
  }
}
