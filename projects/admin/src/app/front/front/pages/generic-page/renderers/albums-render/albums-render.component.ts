import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Snippet } from '../../../../../../common/interfaces/page_snippet.interface';
import { formatRowColsClasses } from '../../../../../../common/utils/ui-utils';
import { BreakpointsSettings } from '../../../../../../common/interfaces/ui-conf.interface';

@Component({
  selector: 'app-albums-render',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './albums-render.component.html',
  styleUrls: ['./albums-render.component.scss']
})
export class AlbumsRenderComponent {
  @Input() snippets: Snippet[] = [];
  @Input() row_cols: BreakpointsSettings = { SM: 1, MD: 2, LG: 3, XL: 4 };

  constructor(private router: Router, private route: ActivatedRoute) {}

  rowCols(): string[] {
    return formatRowColsClasses(this.row_cols);
  }

  trackById(index: number, item: any) {
    return item?.id || index;
  }

  selectAlbum(album: Snippet) {
    this.router.navigate(['.', album.id], { relativeTo: this.route });
  }
}
