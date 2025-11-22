import { ChangeDetectorRef, Component, ElementRef, Input, QueryList, ViewChildren, AfterViewInit, AfterViewChecked, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Snippet } from '../../../../../../common/interfaces/page_snippet.interface';
import { DomSanitizer } from '@angular/platform-browser';
import { BreakpointsSettings } from '../../../../../../common/interfaces/system-conf.interface';

@Component({
  selector: 'app-publication-render',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './publication-render.component.html',
  styleUrls: ['./publication-render.component.scss']
})
export class PublicationRenderComponent implements AfterViewInit, AfterViewChecked, OnChanges {
  @Input() snippets: Snippet[] = [];
  @Input() scroll_to_snippet?: Snippet;
  @Input() row_cols: BreakpointsSettings = { SM: 1, MD: 2, LG: 3, XL: 4 };
  @ViewChildren('textRef') textRefs!: QueryList<ElementRef>;
  textHeights: { [id: string]: number } = {};
  private pendingScrollId?: string;
  selectedAnchorId?: string;

  constructor(
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) { }

  trackById(index: number, item: any) {
    return item.id;
  }

  ngOnInit() {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['scroll_to_snippet'] && this.scroll_to_snippet) {
      // Defer actual scroll until DOM for items is present
      this.pendingScrollId = this.getAnchorId(this.scroll_to_snippet);
      this.selectedAnchorId = this.pendingScrollId;
      this.scheduleTryScroll();
    }
    if (changes['snippets'] && this.pendingScrollId) {
      // Snippets changed (e.g., loaded); try scrolling again once they render
      this.scheduleTryScroll();
    }
  }

  ngAfterViewInit() {
    this.updateTextHeights();
    this.prepareTables();
    this.scheduleTryScroll();
  }

  ngAfterViewChecked() {
    this.updateTextHeights();
    this.prepareTables();
    this.scheduleTryScroll();
  }

  updateTextHeights() {
    if (this.textRefs) {
      this.textRefs.forEach((ref, idx) => {
        const snippet = this.snippets[idx];
        if (snippet && ref.nativeElement) {
          const newHeight = ref.nativeElement.offsetHeight;
          if (this.textHeights[snippet.id] !== newHeight) {
            this.textHeights[snippet.id] = newHeight;
            this.cdr.detectChanges();
          }
        }
      });
    }
  }

    scrollTo(id: string) {
    this.selectedAnchorId = id;
    setTimeout(() => {
      const element = document.getElementById(id);
      if (element) {
        this.scrollElementToTop(element);
        // transient highlight on manual click scroll
        element.classList.add('scroll-highlight');
        setTimeout(() => element.classList.remove('scroll-highlight'), 4200);
      }
    }, 0);
  }

  private scheduleTryScroll() {
    if (!this.pendingScrollId) return;
    // Try after the current cycle to ensure DOM has been updated
    setTimeout(() => {
      this.tryScrollPending();
    }, 0);
  }

  private tryScrollPending() {
    if (!this.pendingScrollId) return;
    const id = this.pendingScrollId;
    const el = document.getElementById(id);
    if (el) {
      this.scrollElementToTop(el);
      // transient highlight on programmatic scroll
      el.classList.add('scroll-highlight');
      setTimeout(() => el.classList.remove('scroll-highlight'), 4200);
      this.pendingScrollId = undefined;
    }
  }

  private scrollElementToTop(el: HTMLElement) {
    try {
      const container = this.getScrollableContainer(el);
      if (container === window) {
        const rect = el.getBoundingClientRect();
        const absoluteTop = rect.top + (window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0);
        window.scrollTo({ top: Math.max(0, absoluteTop), behavior: 'smooth' });
      } else {
        const c = container as HTMLElement;
        const cRect = c.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const targetTop = elRect.top - cRect.top + c.scrollTop;
        c.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
      }
    } catch {
      // fallback to default behavior
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  private getScrollableContainer(el: HTMLElement): Window | HTMLElement {
    let node: HTMLElement | null = el.parentElement;
    while (node && node !== document.body) {
      const style = getComputedStyle(node);
      const overflowY = style.overflowY;
      const canScroll = (overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight;
      if (canScroll) return node;
      node = node.parentElement;
    }
    return window;
  }

  // Generate a safe, unique anchor id for a snippet
  getAnchorId(snippet: Snippet): string {
    const base = this.slugify(snippet.title || 'snippet');
    // Ensure uniqueness by appending the snippet id
    return `${base}--${snippet.id}`;
  }

  isSelected(snippet: Snippet): boolean {
    return this.selectedAnchorId === this.getAnchorId(snippet);
  }

  private slugify(str: string): string {
    return (str || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}+/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80); // limit length for safety
  }

  clampHeight(h?: number) {
    const val = typeof h === 'number' && !isNaN(h) ? h : 100;
    return Math.min(val, 100);
  }

  stringToSafeHtml(htmlString: string) {
    return this.sanitizer.bypassSecurityTrustHtml(htmlString) ;
  }

  private prepareTables() {
    if (!this.textRefs) return;
    this.textRefs.forEach(ref => {
      const root: HTMLElement = ref.nativeElement as HTMLElement;
      // Handle minimal-width tables
      root.querySelectorAll('table.fit-cols').forEach((tableEl) => {
        const table = tableEl as HTMLTableElement;
        if ((table as any)._fitPrepared) return;
        (table as any)._fitPrepared = true;
        try {
          // Ensure auto layout and inline shrink
          table.style.tableLayout = 'auto';
          // Force true shrink-to-content at inline style level
          (table.style as any).setProperty('width', 'max-content', 'important');
          (table.style as any).setProperty('display', 'inline-table', 'important');

          // Add colgroup with minimal width hints per column
          let firstRow: HTMLTableRowElement | null = null;
          if (table.tHead && table.tHead.rows.length > 0) {
            firstRow = table.tHead.rows[0];
          } else if (table.tBodies && table.tBodies.length > 0 && table.tBodies[0].rows.length > 0) {
            firstRow = table.tBodies[0].rows[0];
          } else if (table.rows && table.rows.length > 0) {
            firstRow = table.rows[0];
          }
          if (firstRow) {
            const colCount = firstRow.cells.length;
            if (colCount > 0) {
              const existingCg = table.querySelector('colgroup');
              if (!existingCg) {
                const cg = document.createElement('colgroup');
                for (let i = 0; i < colCount; i++) {
                  const col = document.createElement('col');
                  (col.style as any).setProperty('width', '1%');
                  cg.appendChild(col);
                }
                table.insertBefore(cg, table.firstChild);
              }
            }
          }

          // Enforce nowrap in cells to keep them minimal
          table.querySelectorAll('th,td').forEach((cell) => {
            const c = cell as HTMLElement;
            c.style.whiteSpace = 'nowrap';
          });
        } catch (e) {
          // noop; avoid breaking render
        }
      });
    });
  }
  

}
