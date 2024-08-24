import { Component } from '@angular/core';
import { ArticlesService } from '../../../../../common/site-layout_and_contents/articles.service';
import { CommonModule } from '@angular/common';
import { Article } from '../../../../../common/menu.interface';
import { Router } from '@angular/router';

@Component({
  selector: 'app-articles',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './articles.component.html',
  styleUrl: './articles.component.scss'
})
export class ArticlesComponent {
  articles: Article[] = [];
  constructor(
    private articlesService: ArticlesService,
    private router: Router
  ) {

    this.articlesService.articles$.subscribe((articles) => {
      this.articles = articles;
    });

  }

  onAdd() {
    const newArticle = {
      id: '',
      title: 'New Article',
      content: 'Content goes here',
    }
    let article = this.articlesService.createArticle(newArticle);
    console.log('new article', article);
  }
  onDelete(articleId: string) {
    this.articlesService.deleteArticle(articleId).then((articleId) => {
    }).catch((error) => {
      console.error('article deletion error', error);
    });
  }

  onEdit(article: Article) {
    this.router.navigate(['/article', article.id]);

  }
}
