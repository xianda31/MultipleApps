import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MENU_TITLES, Snippet } from '../../../../../../common/interfaces/page_snippet.interface';
import { TruncatePipe } from '../../../../../../common/pipes/truncate.pipe';
import { Router } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-cards-img-top-left-render',
  standalone: true,
  imports: [CommonModule, TruncatePipe],
  templateUrl: './cards-img-top-left-render.component.html',
  styleUrls: ['./cards-img-top-left-render.component.scss']
})
export class CardsImgTopLeftRenderComponent {
  @Input() snippets: Snippet[] = [];

    read_more: boolean = true;
  TRUNCATE_LIMIT = 300; //  truncating news content
  TRUNCATE_HYSTERISIS = 50; // threshold to show "Read more" link
   constructor(
    private router: Router,
  private sanitizer: DomSanitizer

  ) { }

  trackById(index: number, item: any) {
    return item.id;
  }
    readMore(snippet: Snippet) {
      // console.log('Navigating to page:', snippet.pageId);
    // PATCH à CORRIGER ASAP
      if(snippet.pageId === MENU_TITLES.NEWS) {
        this.router.navigate(['/front/news', snippet.title]);
      }else if(snippet.pageId === MENU_TITLES.AUTRES_RDV) {
        this.router.navigate(['/front/tournaments/autres_rdv', snippet.title]);
      }
    }

      stringToSafeHtml(htmlString: string) {
    return this.sanitizer.bypassSecurityTrustHtml(htmlString) ;
  }

  
}
