import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { Article, ArticleTemplateEnum, RenderingModeEnum } from '../interfaces/menu.interface';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { ReplacePipe } from '../pipes/replace.pipe';
import { FileService } from '../services/files.service';
import { HeadPipe } from '../pipes/trail.pipe';
import { TrailPipe } from '../pipes/head.pipe';

@Component({
    selector: 'app-render-article',
    imports: [CommonModule, ReplacePipe, HeadPipe, TrailPipe],
    templateUrl: './render-article.component.html',
    styleUrl: './render-article.component.scss'
})
export class RenderArticleComponent implements OnChanges {
  @Input() article!: Article;
  @Input() rendering: RenderingModeEnum = RenderingModeEnum.Full;
  @Output() follow = new EventEmitter<Article>();
  articleTemplateEnum = ArticleTemplateEnum;
  renderMode = RenderingModeEnum;

  signedUrl!: Promise<URL>

  constructor(
    private FileService: FileService
  ) {
    // this.signedUrl = this.FileService.placeholderUrl();

    // console.log('this.article', this.article);
  }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['article']) {
      if (this.article.image) {
        this.signedUrl = this.FileService.getPresignedUrl(this.article.image);
        // console.log('this.signedUrl', this.signedUrl);
      }
    }
  }
  onFollow(article: Article) {
    this.follow.emit(article);
  }

}

