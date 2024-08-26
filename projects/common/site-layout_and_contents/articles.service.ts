import { Injectable } from '@angular/core';
import { Article } from '../menu.interface';
import { BehaviorSubject } from 'rxjs';
import { generateClient } from 'aws-amplify/api';
import { Schema } from '../../../amplify/data/resource';

@Injectable({
  providedIn: 'root'
})
export class ArticlesService {
  private articles: Article[] = [];
  private _articles$ = new BehaviorSubject<Article[]>(this.articles);

  articles$ = this._articles$.asObservable();

  constructor() {
    const client = generateClient<Schema>();
    client.models.Article.observeQuery({ selectionSet: ["id", "title", "content", "template", "featured", "pageId"] })
      .subscribe({
        next: (data) => {
          this.articles = data.items as unknown as Article[];
          this._articles$.next(this.articles);
        },
        error: (error) => {
          console.error('error', error);
        }
      });
  }

  // articlesSubscription() {
  //   const client = generateClient<Schema>();
  //   client.models.Article.observeQuery({ selectionSet: ["id", "title", "content", "pageId", "pageId"] })
  //     .subscribe({
  //       next: (data) => {
  //         this.articles = data.items as unknown as Article[];
  //         this._articles$.next(this.articles);
  //       },
  //       error: (error) => {
  //         console.error('error', error);
  //       }
  //     });
  // }

  listArticles() {
    const client = generateClient<Schema>();
    client.models.Article.list({ selectionSet: ["id", "title", "content", "template", "featured", "pageId"] })
      .then(({ data, errors }) => {
        if (errors) {
          console.error('errors', errors);
        }
        this.articles = data as unknown as Article[];
        this._articles$.next(this.articles);
      });
  }

  createArticle(article: Article) {
    return new Promise((resolve, reject) => {
      const client = generateClient<Schema>();
      let { id, ...articleCreateInput } = article;
      client.models.Article.create(articleCreateInput)
        .then(({ data, errors }) => {
          if (errors) { reject('Article not created') }
          let newArticle: Article = { id: data?.id!, ...articleCreateInput };
          this.articles.push(newArticle);
          this._articles$.next(this.articles);
          this.listArticles();
          resolve(newArticle);
        });
    });
  }

  readArticle(articleId: string) {
    return new Promise<Article>((resolve, reject) => {
      const client = generateClient<Schema>();
      client.models.Article.get({ id: articleId })
        .then(({ data, errors }) => {
          if (errors) { reject('Article not found') }
          resolve(data as unknown as Article);
        });
    });
  }

  updateArticle(article: Article) {
    return new Promise((resolve, reject) => {
      const client = generateClient<Schema>();
      client.models.Article.update(article)
        .then((data) => {
          this.articles = this.articles.map(a => a.id === article.id ? article : a);
          this._articles$.next(this.articles);
          resolve(article);
        })
        .catch((error) => {
          console.error('error', error);
          reject('Article not updated');
        });
    }
    );
  }

  deleteArticle(articleId: string) {
    return new Promise((resolve, reject) => {
      const client = generateClient<Schema>();
      client.models.Article.delete({ id: articleId })
        .then(({ data, errors }) => {
          if (errors) { reject('Article not deleted') }
          this.articles = this.articles.filter(article => article.id !== articleId);
          this._articles$.next(this.articles);
          resolve(articleId);
        });
    });
  }
}
