import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Snippet } from '../../../../../../common/interfaces/page_snippet.interface';
import { BreakpointsSettings } from '../../../../../../common/interfaces/system-conf.interface';
import { DomSanitizer } from '@angular/platform-browser';
import { formatRowColsClasses } from '../../../../../../common/utils/ui-utils';

@Component({
  selector: 'app-cards-img-top-render',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cards-img-top-render.component.html',
  styleUrls: ['./cards-img-top-render.component.scss']
})
export class CardsImgTopRenderComponent {
  @Input() snippets: Snippet[] = [];
  @Input() row_cols: BreakpointsSettings = { SM: 1, MD: 2, LG: 3, XL: 4 };
  constructor(private sanitizer: DomSanitizer) { }

  trackById(index: number, item: any) {
    return item.id;
  }

    stringToSafeHtml(htmlString: string) {
    return this.sanitizer.bypassSecurityTrustHtml(htmlString) ;
  }

    rowCols(): string[] {
      return formatRowColsClasses(this.row_cols);
    }
}
