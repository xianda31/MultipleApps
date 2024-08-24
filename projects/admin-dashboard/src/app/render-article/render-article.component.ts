import { Component, Input } from '@angular/core';
import { Article } from '../../../../common/menu.interface';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-render-article',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './render-article.component.html',
  styleUrl: './render-article.component.scss'
})
export class RenderArticleComponent {
  @Input('article') article!: Article;
  // loaded: boolean = false;
  // template: string = '';
  // constructor() {
  // }
  // ngOnChanges(changes: SimpleChanges): void {
  //   if (changes['article']) {
  //     // console.log('change', changes['article']);
  //     // this.template = this.article.template.toString();
  //     // this.loaded = true;
  //     // console.log('template', this.template);
  //   }
  // } 
}

