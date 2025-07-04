import { Component, OnDestroy } from '@angular/core';
import { ArticlesService } from '../../../../../common/services/articles.service';
import { CommonModule } from '@angular/common';
import { Article, Page, ArticleTemplateEnum } from '../../../../../common/menu.interface';
import { Router } from '@angular/router';
import { SiteLayoutService } from '../../../../../common/services/site-layout.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ArticleComponent } from "../article/article.component";
import { ToastService } from '../../../../../common/toaster/toast.service';

@Component({
    selector: 'app-articles',
    imports: [CommonModule, FormsModule, ReactiveFormsModule, ArticleComponent],
    templateUrl: './articles.component.html',
    styleUrl: './articles.component.scss'
})
export class ArticlesComponent implements OnDestroy {
  articles: Article[] = [];
  pages: Page[] = [];
  articles_subscription: any;
  pages_subscription: any;

  articleToEdit: Article | null = null;
  constructor(
    private articlesService: ArticlesService,
    private siteLayoutService: SiteLayoutService,
    private toastService: ToastService,
  ) {

    this.articles_subscription = this.articlesService.articles$.subscribe((articles) => {
      this.articles = articles
        .sort((a, b) => a.rank - b.rank)
        .sort((a, b) => a.pageId?.localeCompare(b.pageId || '') || 0);
      // console.log('articles', this.articles);
    });

    this.pages_subscription = this.siteLayoutService.getPages().subscribe((pages) => {
      this.pages = pages;
      // console.log('pages', this.pages);
    });

  }
  ngOnDestroy(): void {
    this.articles_subscription.unsubscribe();
    this.pages_subscription.unsubscribe();
  }

  onPageSelect(article: Article) {
    this.articlesService.updateArticle(article)
      .then((article) => {
        this.toastService.showSuccess('article', 'Article mis à jour');
        // console.log('article updated', article);
      })
      .catch((error) => {
        // console.error('article update error', error);
      });

  }

  onFeaturedSelect(article: Article) {
    this.articlesService.updateArticle(article)
      .then((article) => {
        this.toastService.showSuccess('articles', 'Article mis à jour');
      })
      .catch((error) => {
        console.error('article update error', error);
      });
  }


  onAdd() {
    const newArticle: Article = {
      id: '',
      title: 'titre de l\'article',
      content: 'contenu de l\'article (en HTML)',
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
  }

  onDone() {
    this.articleToEdit = null;
  }
}
