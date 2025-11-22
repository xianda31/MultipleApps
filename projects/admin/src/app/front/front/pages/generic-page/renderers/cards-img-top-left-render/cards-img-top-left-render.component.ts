import { AfterViewChecked, AfterViewInit, Component, ElementRef, Input, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MENU_TITLES, Snippet } from '../../../../../../common/interfaces/page_snippet.interface';
import { BreakpointsSettings } from '../../../../../../common/interfaces/system-conf.interface';
import { Router } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { formatRowColsClasses } from '../../../../../../common/utils/ui-utils';

@Component({
  selector: 'app-cards-img-top-left-render',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cards-img-top-left-render.component.html',
  styleUrls: ['./cards-img-top-left-render.component.scss']
})
export class CardsImgTopLeftRenderComponent implements AfterViewInit, AfterViewChecked {
  @Input() row_cols: BreakpointsSettings = { SM: 1, MD: 2, LG: 3, XL: 4 };
  @Input() snippets: Snippet[] = [];
  @ViewChildren('clampRef') clampRefs!: QueryList<ElementRef<HTMLElement>>;

  read_more: boolean = true;
  // Track if a snippet's text is visually overflowing (clamped)
  private overflowMap: Record<string, boolean> = {};
  private overflowCheckScheduled = false;
   constructor(
    private router: Router,
  private sanitizer: DomSanitizer

  ) { }

  trackById(index: number, item: any) {
    return item.id;
  }
  ngAfterViewInit() {
    this.scheduleOverflowCheck();
  }

  ngAfterViewChecked() {
    this.scheduleOverflowCheck();
  }

  private scheduleOverflowCheck() {
    if (this.overflowCheckScheduled) return;
    this.overflowCheckScheduled = true;
    setTimeout(() => {
      this.overflowCheckScheduled = false;
      this.updateOverflowInternal();
    }, 0);
  }

  private updateOverflowInternal() {
    if (!this.clampRefs) return;
    const refs = this.clampRefs.toArray();
    for (let i = 0; i < refs.length; i++) {
      const el = refs[i]?.nativeElement;
      const id = this.snippets[i]?.id as string | undefined;
      if (!el || !id) continue;
      // Detect if content is visually truncated: scrollHeight > clientHeight
      const isOverflowing = el.scrollHeight - el.clientHeight > 1; // tolerance
      if (this.overflowMap[id] !== isOverflowing) {
        this.overflowMap[id] = isOverflowing;
      }
    }
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
    isOverflow(id: string): boolean {
      return !!this.overflowMap[id];
    }

      stringToSafeHtml(htmlString: string) {
    return this.sanitizer.bypassSecurityTrustHtml(htmlString) ;
  }

      // Compute bootstrap row classes from the `row_cols` input (breakpoints settings).
      rowCols(): string[] {
        return formatRowColsClasses(this.row_cols);
      }

  
}
