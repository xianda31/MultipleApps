import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SiteLayoutService } from '../../../../../common/site-layout_and_contents/site-layout.service';
import { Article, Page } from '../../../../../common/menu.interface';
import { CommonModule } from '@angular/common';
import { RenderArticleComponent } from '../../../../../common/render-article/render-article.component';
import { ArticlesService } from '../../../../../common/site-layout_and_contents/articles.service';
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
      // });
      this.articlesService.articles$.subscribe((articles: Article[]) => {
        this.articles = articles
          .filter((article) => article.pageId === pageId)
          .sort((a, b) => a.rank - b.rank);
        // .sort((a, b) => a.featured ? -1 : 1);
      });
    });
  }
}
