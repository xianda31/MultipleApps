import { Component } from '@angular/core';
import { SiteLayoutService } from '../../../../../common/services/site-layout.service';
import { Page } from '../../../../../common/menu.interface';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RenderArticleComponent } from '../../../../../common/render-article/render-article.component';
import { Router } from '@angular/router';
import { RenderingMode } from '../../../../../common/render-article/render-article.interface';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RenderArticleComponent],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss'
})
export class HomePageComponent {
  pages !: Page[];
  renderMode = RenderingMode;
  constructor(
    private siteLayoutService: SiteLayoutService,
    private router: Router
  ) {
    this.siteLayoutService.pages$.subscribe((pages) => {
      this.pages = pages;
      // console.log('HomePageComponent.pages', this.pages);
    });
  }

  hasFeaturedArticles(page: Page): boolean {
    return page.articles ? page.articles.some((article) => article.featured) : false;
  }

  onFollow(article: any) {
    let page = this.pages.find((p) => p.id === article.pageId);
    if (!page) {
      console.error('article\'s page not found', article.pageId);
      return;
    } else {
      this.router.navigate(['/' + page.link]);
    }
  }
}
