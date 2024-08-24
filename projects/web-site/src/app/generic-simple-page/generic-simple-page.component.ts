import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SiteLayoutService } from '../../../../common/site-layout_and_contents/site-layout.service';
import { Page } from '../../../../common/menu.interface';
import { CommonModule } from '@angular/common';
import { RenderArticleComponent } from '../../../../common/render-article/render-article.component';

@Component({
  selector: 'app-generic-simple-page',
  standalone: true,
  imports: [CommonModule, RenderArticleComponent],
  templateUrl: './generic-simple-page.component.html',
  styleUrl: './generic-simple-page.component.scss'
})
export class GenericSimplePageComponent {
  pageId!: string;
  page!: Page;
  constructor(
    private router: ActivatedRoute,
    private siteLayoutService: SiteLayoutService
  ) {
    this.router.data.subscribe(async data => {
      let { pageId } = data;
      this.pageId = pageId;
      this.page = await this.siteLayoutService.readPage(this.pageId);
      // console.log(page);
    });
  }
}
