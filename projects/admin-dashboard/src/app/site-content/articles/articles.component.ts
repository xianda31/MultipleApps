import { Component } from '@angular/core';
import { ArticlesService } from '../../../../../common/services/articles.service';
import { CommonModule } from '@angular/common';
import { Article, Page, ArticleTemplateEnum } from '../../../../../common/menu.interface';
import { Router } from '@angular/router';
import { SiteLayoutService } from '../../../../../common/services/site-layout.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ArticleComponent } from "../article/article.component";

@Component({
  selector: 'app-articles',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ArticleComponent],
  templateUrl: './articles.component.html',
  styleUrl: './articles.component.scss'
})
export class ArticlesComponent {
  articles: Article[] = [];
  pages: Page[] = [];
  articleToEdit: Article | null = null;
  constructor(
    private articlesService: ArticlesService,
    private siteLayoutService: SiteLayoutService,
  ) {

    this.articlesService.articles$.subscribe((articles) => {
      this.articles = articles
        .sort((a, b) => a.rank - b.rank)
        .sort((a, b) => a.pageId?.localeCompare(b.pageId || '') || 0);
      // console.log('articles', this.articles);
    });

    this.siteLayoutService.pages$.subscribe((pages) => {
      this.pages = pages;
    });

  }

  onPageSelect(article: Article) {
    this.articlesService.updateArticle(article)
      .then((article) => {
        // console.log('article updated', article);
      })
      .catch((error) => {
        // console.error('article update error', error);
      });

  }

  onFeaturedSelect(article: Article) {
    console.log('onFeaturedSelect', article.featured);
    this.articlesService.updateArticle(article)
      .then((article) => {
        // console.log('article updated', article);
      })
      .catch((error) => {
        // console.error('article update error', error);
      });
  }
  // onRankChange(article: Article) {
  //   this.articlesService.updateArticle(article)
  //     .then((article) => {
  //       // console.log('article rank updated', article.rank);
  //       // console.log('article updated', this.articles);
  //     })
  //     .catch((error) => {
  //       // console.error('article update error', error);
  //     });
  // }


  onAdd() {
    const newArticle: Article = {
      id: '',
      title: 'New Article',
      content: 'Content goes here',
      template: ArticleTemplateEnum.default,
      rank: 0,
      featured: false,
    }

    let article = this.articlesService.createArticle(newArticle);
    console.log('new article', article);
  }
  onDelete(articleId: string) {
    this.articlesService.deleteArticle(articleId).then((articleId) => {
    }).catch((error) => {
      console.error('article deletion error', error);
    });
    this.articleToEdit = null;
  }

  onEdit(article: Article) {
    this.articleToEdit = article;
    // this.router.navigate(['/article', article.id]);

  }

  onDone() {
    this.articleToEdit = null;
  }
}
