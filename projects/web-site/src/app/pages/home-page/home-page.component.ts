import { Component } from '@angular/core';
import { SiteLayoutService } from '../../../../../common/site-layout_and_contents/site-layout.service';
import { Page } from '../../../../../common/menu.interface';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RenderArticleComponent } from '../../../../../common/render-article/render-article.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RenderArticleComponent],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss'
})
export class HomePageComponent {
  pages !: Page[];
  constructor(
    private siteLayoutService: SiteLayoutService,
    private router: Router
  ) {
    this.siteLayoutService.pages$.subscribe((pages) => {
      this.pages = pages;
      console.log('HomePageComponent.pages', this.pages);
    });
  }

  hasFeaturedArticles(page: Page): boolean {
    return page.articles ? page.articles.some((article) => article.featured) : false;
  }

  onFollow(article: any) {
    console.log('onFollow', article);
    let page = this.pages.find((p) => p.id === article.pageId);
    if (!page) {
      console.error('article\'s page not found', article.pageId);
      return;
    } else {
      // console.log('navigate to', '/' + page.link);
      this.router.navigate(['/' + page.link]);
    }
  }
}
