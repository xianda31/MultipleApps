import { Component, Input } from '@angular/core';
import { ElementRef, QueryList, ViewChildren, AfterViewInit, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Snippet } from '../../../../../../common/interfaces/page_snippet.interface';
import { BreakpointsSettings } from '../../../../../../common/interfaces/ui-conf.interface';
import { DomSanitizer } from '@angular/platform-browser';
import { attachExternalLinkHandler } from '../../utils/util_click_handler';

@Component({
  selector: 'app-sequential-render',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sequential-render.component.html',
  styleUrls: ['./sequential-render.component.scss']
})
export class SequentialRenderComponent {
    @ViewChildren('textRef') textRefs!: QueryList<ElementRef<HTMLElement>>;
  @Input() snippets: Snippet[] = [];
  @Input() row_cols: BreakpointsSettings = { SM: 1, MD: 2, LG: 3, XL: 4 };
  constructor(private sanitizer: DomSanitizer) { }

  trackById(index: number, item: any) {
    return item.id;
  }
    stringToSafeHtml(htmlString: string) {
    return this.sanitizer.bypassSecurityTrustHtml(htmlString) ;
  }
  ngAfterViewInit() {
    this.attachLinkHandlers();
  }

  ngAfterViewChecked() {
    this.attachLinkHandlers();
  }

  private attachLinkHandlers() {
    if (!this.textRefs) return;
    this.textRefs.forEach((ref: ElementRef<HTMLElement>) => {
      const root: HTMLElement = ref.nativeElement;
      attachExternalLinkHandler(root);
    });
  }
}
