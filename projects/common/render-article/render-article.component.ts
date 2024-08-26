import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Article } from '../../common/menu.interface';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { TrunkPipe } from '../pipes/trunk.pipe';
import { ReplacePipe } from '../pipes/replace.pipe';

@Component({
  selector: 'app-render-article',
  standalone: true,
  imports: [CommonModule, ReplacePipe, TrunkPipe],
  templateUrl: './render-article.component.html',
  styleUrl: './render-article.component.scss'
})
export class RenderArticleComponent {
  @Input('article') article!: Article;
  @Input() featuredMode: boolean = false;
  @Output() follow = new EventEmitter<Article>();

  constructor() {

  }
  onFollow(article: Article) {
    this.follow.emit(article);
  }

}

