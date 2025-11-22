import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Snippet } from '../../../../../../common/interfaces/page_snippet.interface';
import { AlbumComponent } from '../../../../../album/album.component';
import { formatRowColsClasses } from '../../../../../../common/utils/ui-utils';
import { BreakpointsSettings } from '../../../../../../common/interfaces/system-conf.interface';

@Component({
  selector: 'app-albums-render',
  standalone: true,
  imports: [CommonModule,AlbumComponent],
  templateUrl: './albums-render.component.html',
  styleUrls: ['./albums-render.component.scss']
})
export class AlbumsRenderComponent {
  @Input() snippets: Snippet[] = [];
  @Input() row_cols: BreakpointsSettings = { SM: 1, MD: 2, LG: 3, XL: 4 };

  rowCols(): string[] {
    return formatRowColsClasses(this.row_cols);
  }

  trackById(index: number, item: any) {
    return item.id;
  }
}
