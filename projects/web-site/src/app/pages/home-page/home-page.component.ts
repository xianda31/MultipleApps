import { Component, OnDestroy } from '@angular/core';
import { SiteLayoutService } from '../../../../../common/services/site-layout.service';
import { Article, Page, RenderingModeEnum } from '../../../../../common/menu.interface';
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
export class HomePageComponent implements OnDestroy {
  pages !: Page[];
  pages_subscription!: any;
  renderingModeEnum = RenderingModeEnum;
  constructor(
    private siteLayoutService: SiteLayoutService,
    private router: Router
  ) {
    this.pages_subscription = this.siteLayoutService.getPages().subscribe((pages) => {
      this.pages = pages;
    });
  }
  ngOnDestroy(): void {
    this.pages_subscription.unsubscribe();
  }


  onFollow(article: Article) {
    let page = this.pages.find((p) => p.id === article.pageId);
    if (!page) {
      console.error('article\'s page not found', article.pageId);
      return;
    } else {
      console.log('following', page.link);
      this.router.navigate(['/' + page.link.replace(' ', '-')]);
    }
  }
}
