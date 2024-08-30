import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { Article } from '../../common/menu.interface';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { TrunkPipe } from '../pipes/trunk.pipe';
import { ReplacePipe } from '../pipes/replace.pipe';
import { FileService } from '../services/files.service';

@Component({
  selector: 'app-render-article',
  standalone: true,
  imports: [CommonModule, ReplacePipe, TrunkPipe],
  templateUrl: './render-article.component.html',
  styleUrl: './render-article.component.scss'
})
export class RenderArticleComponent implements OnChanges {
  @Input() article!: Article;
  @Input() featuredMode: boolean = false;
  @Output() follow = new EventEmitter<Article>();

  signedUrl!: Promise<URL>

  constructor(
    private FileService: FileService
  ) {
    // this.signedUrl = this.FileService.placeholderUrl();

    // console.log('this.article', this.article);
  }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['article']) {
      console.log('changes', this.article);
      if (this.article.image) {
        this.signedUrl = this.FileService.getPresignedUrl(this.article.image);
        console.log('this.signedUrl', this.signedUrl);
      }
    }
  }
  onFollow(article: Article) {
    this.follow.emit(article);
  }

}

