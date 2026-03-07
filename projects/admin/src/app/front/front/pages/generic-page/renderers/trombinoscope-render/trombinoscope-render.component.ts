import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Snippet } from '../../../../../../common/interfaces/page_snippet.interface';
import { BreakpointsSettings } from '../../../../../../common/interfaces/ui-conf.interface';
import { formatRowColsClasses } from '../../../../../../common/utils/ui-utils';

@Component({
  selector: 'app-trombinoscope-render',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './trombinoscope-render.component.html',
  styleUrls: ['./trombinoscope-render.component.scss']
})
export class TrombinoscopeRenderComponent {
  @Input() snippets: Snippet[] = [];
  @Input() row_cols: BreakpointsSettings = { SM: 1, MD: 2, LG: 3, XL: 4 };

  trackById(index: number, item: any) {
    return item.id;
  }

  rowCols(): string[] {
    return 'row row-cols-2 row-cols-sm-3 row-cols-md-3 row-cols-lg-3 row-cols-xl-4 g-3justify-content-center'.split(' ');
    return formatRowColsClasses(this.row_cols);
  }
}
