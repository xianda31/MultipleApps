import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Snippet } from '../../../../../../common/interfaces/page_snippet.interface';
import { DomSanitizer } from '@angular/platform-browser';
import { formatRowColsClasses } from '../../../../../../common/utils/ui-utils';
import { BreakpointsSettings } from '../../../../../../common/interfaces/system-conf.interface';

@Component({
  selector: 'app-flipper-render',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './flipper-render.component.html',
  styleUrls: ['./flipper-render.component.scss']
})
export class FlipperRenderComponent {
  @Input() snippets: Snippet[] = [];
  @Input() row_cols: BreakpointsSettings = { SM: 1, MD: 2, LG: 3, XL: 4 };
  
  constructor(private sanitizer: DomSanitizer) { }
    FLIPPER_PERIOD = 10000; // ms
    ROTATION_DURATION = 4000; // ms

    CARD_STYLE : string = 'lateral'
    
  currentIndex: number = 0;
  flipperInterval: any;

  get rotationDurationSec(): string {
    return (this.ROTATION_DURATION / 1000) + 's';
  }


  trackById(index: number, item: any) {
    return item.id;
  }

  rowCols(): string[] {
    return formatRowColsClasses(this.row_cols);
  }

  ngOnInit() {
    if (this.snippets.length > 1) {
      this.flipperInterval = setInterval(() => {
        this.currentIndex = (this.currentIndex + 1) % this.snippets.length;
      }, this.FLIPPER_PERIOD);
    }
  }

    stringToSafeHtml(htmlString: string) {
    return this.sanitizer.bypassSecurityTrustHtml(htmlString) ;
  }
}
