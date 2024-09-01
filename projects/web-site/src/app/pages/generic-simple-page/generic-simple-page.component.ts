import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SiteLayoutService } from '../../../../../common/services/site-layout.service';
import { Article, PageTemplateEnum, Page } from '../../../../../common/menu.interface';
import { CommonModule } from '@angular/common';
import { RenderArticleComponent } from '../../../../../common/render-article/render-article.component';
import { ArticlesService } from '../../../../../common/services/articles.service';
@Component({
  selector: 'app-generic-simple-page',
  standalone: true,
  imports: [CommonModule, RenderArticleComponent],
  templateUrl: './generic-simple-page.component.html',
  styleUrl: './generic-simple-page.component.scss'
})
export class GenericSimplePageComponent {
  path!: string;
  page!: Page;
  articles: Article[] = [];

  pageTemplateEnum = PageTemplateEnum;
  constructor(
    private router: ActivatedRoute,
    private articlesService: ArticlesService,
    private siteLayoutService: SiteLayoutService
  ) {

    this.router.data.subscribe(async data => {
      let { pageId } = data;
      // this.siteLayoutService.pages$.subscribe((pages) => {
      this.siteLayoutService.getFullPathAsync(pageId).then((path) => {
        this.path = path;
      });

      this.siteLayoutService.readPage(pageId).then((page) => {
        this.page = page;
        this.page.articles = this.page.articles?.sort((a, b) => a.rank - b.rank) || [];
      });

    });

  }
}
