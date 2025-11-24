import { Component, Input, OnChanges, SimpleChanges, OnDestroy, AfterViewInit, AfterViewChecked, ElementRef, QueryList, ViewChildren, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MENU_TITLES, Snippet } from '../../../../../../common/interfaces/page_snippet.interface';
import { BreakpointsSettings } from '../../../../../../common/interfaces/ui-conf.interface';
import { Router } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { SystemDataService } from '../../../../../../common/services/system-data.service';
import { Subscription } from 'rxjs';
import { formatRowColsClasses } from '../../../../../../common/utils/ui-utils';

@Component({
  selector: 'app-a-la-une-render',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './a-la-une-render.component.html',
  styleUrls: ['./a-la-une-render.component.scss']
})
export class ALaUneRenderComponent implements OnChanges, OnDestroy, AfterViewInit, AfterViewChecked {
  @Input() snippets: Snippet[] = [];
  @Input() selected_title?: string; // for news, the title of the selected snippet
  @Input() row_cols: BreakpointsSettings = { SM: 1, MD: 2, LG: 3, XL: 4 };

  read_more: boolean = true;
  // number of lines to show before truncating (controlled from UI settings)
  read_more_lines: number = 3;
  // char-based truncate limit derived from `read_more_lines` (approximate)
  TRUNCATE_LIMIT = 300; // will be recalculated when settings arrive
  TRUNCATE_HYSTERISIS = 50; // threshold to show "Read more" link
  private uiSub?: Subscription;
  // if true, hovering unfolds the card entirely
  unfold_on_hover: boolean = false;
  // currently hovered snippet id (used when unfold_on_hover is enabled)
  hoveredSnippetId: string | null = null;
  // hover timer id used to delay expansion
  private hoverTimer: any;
  // hover delay in ms (read from UI settings)
  hoverDelayMs: number = 500;
  // hover animation duration (ms)
  hoverDurationMs: number = 300;
  // small screen or touch detection
  isSmallScreenOrTouch: boolean = false;
  @ViewChildren('clampContainer') clampContainers!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('clampRef') clampRefs!: QueryList<ElementRef<HTMLElement>>;

  // Track if a snippet's text is visually overflowing (clamped)
  private overflowMap: Record<string, boolean> = {};
  private overflowCheckScheduled = false;
  constructor(
    private router: Router,
    private sanitizer: DomSanitizer

    , private systemDataService: SystemDataService
  ) {
    this.updateIsSmallScreenOrTouch();
    // subscribe to UI settings to pick up `read_more_lines` changes
    this.uiSub = this.systemDataService.get_ui_settings().subscribe((ui: any) => {
      try {
        const rl = (ui && ui.homepage && ui.homepage.read_more_lines) ? ui.homepage.read_more_lines : ui?.read_more_lines ?? 3;
        this.read_more_lines = (rl !== undefined && rl !== null) ? Number(rl) : 3;
        // approximate: 120 chars per line
        this.TRUNCATE_LIMIT = Math.max(0, Math.round(this.read_more_lines * 120));
        this.unfold_on_hover = !!(ui && ui.homepage && ui.homepage.unfold_on_hover) || !!ui?.unfold_on_hover;
        this.hoverDelayMs = (ui && ui.homepage && ui.homepage.hover_unfold_delay_ms) ? Number(ui.homepage.hover_unfold_delay_ms) : (ui?.hover_unfold_delay_ms ?? 500);
        this.hoverDurationMs = (ui && ui.homepage && ui.homepage.hover_unfold_duration_ms) ? Number(ui.homepage.hover_unfold_duration_ms) : (ui?.hover_unfold_duration_ms ?? 300);
      } catch (e) { /* ignore */ }
    });
  }

  setHover(id: any) {
    if (!this.unfold_on_hover || this.isSmallScreenOrTouch) return;
    // delay expansion by 500ms; cancel any previous timer
    this.cancelHoverTimer();
    this.hoverTimer = setTimeout(() => {
      this.hoveredSnippetId = id !== undefined && id !== null ? String(id) : null;
      this.hoverTimer = undefined;
      // animate expansion for this snippet
      this.animateExpandForId(this.hoveredSnippetId ?? undefined, true);
    }, this.hoverDelayMs);
  }

  clearHover() {
    // cancel any pending expansion and collapse immediately
    this.cancelHoverTimer();
    if (!this.unfold_on_hover || this.isSmallScreenOrTouch) return;
    this.hoveredSnippetId = null;
    // animate collapse for previous snippet
    this.animateExpandForId(undefined, false);
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.updateIsSmallScreenOrTouch();
  }

  @HostListener('window:touchstart')
  onFirstTouch() {
    // Re-evaluate small-screen state on first touch; do not force tap-mode on large touch-capable laptops
    this.updateIsSmallScreenOrTouch();
  }

  private updateIsSmallScreenOrTouch() {
    try {
      const mq = window.matchMedia('(max-width: 768px)');
      const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) || (navigator as any).msMaxTouchPoints > 0;
      const isMobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
      // Enable tap-mode only for touch phones in portrait (height > width) and small/mobile UA.
      const isPortrait = (typeof window.innerHeight === 'number' && typeof window.innerWidth === 'number') ? window.innerHeight > window.innerWidth : false;
      this.isSmallScreenOrTouch = !!hasTouch && isPortrait && (mq.matches || isMobileUA);
    } catch (e) { this.isSmallScreenOrTouch = false; }
  }

  onTapToggle(id: any, ev: Event) {
    // Only handle taps on small/touch devices when unfold_on_hover is enabled
    if (!this.unfold_on_hover || !this.isSmallScreenOrTouch) return;
    ev.stopPropagation();
    this.cancelHoverTimer();
    const sid = id !== undefined && id !== null ? String(id) : null;
    if (this.hoveredSnippetId === sid) {
      // collapse
      this.hoveredSnippetId = null;
      this.animateExpandForId(sid ?? undefined, false);
    } else {
      // expand
      this.hoveredSnippetId = sid;
      this.animateExpandForId(sid ?? undefined, true);
    }
  }

  isHovered(id: any): boolean {
    if (!this.unfold_on_hover) return false;
    return id !== undefined && id !== null && this.hoveredSnippetId === String(id);
  }

  private cancelHoverTimer() {
    try {
      if (this.hoverTimer) {
        clearTimeout(this.hoverTimer);
        this.hoverTimer = undefined;
      }
    } catch (e) { /* ignore */ }
  }

  getClampStyle(id: any): { [k: string]: any } {
    const hovered = this.isHovered(id);
    if (hovered) {
      return { 'display': 'block', 'overflow': 'visible' };
    }
    return {
      'display': '-webkit-box',
      '-webkit-box-orient': 'vertical',
      '-webkit-line-clamp': String(this.read_more_lines),
      'overflow': 'hidden'
    };
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
      const isOverflowing = el.scrollHeight - el.clientHeight > 1;
      if (this.overflowMap[id] !== isOverflowing) {
        this.overflowMap[id] = isOverflowing;
      }
    }
  }

  private findContainerById(id: string | undefined): HTMLElement | null {
    if (!id) return null;
    const idx = this.snippets.findIndex(s => String(s.id) === String(id));
    const arr = this.clampContainers ? this.clampContainers.toArray() : [];
    if (idx >= 0 && idx < arr.length) return arr[idx].nativeElement as HTMLElement;
    return null;
  }

  private animateExpandForId(id: string | undefined, expand: boolean) {
    const container = this.findContainerById(id);
    if (!container) return;
    this.animateContainer(container, expand);
  }

  private animateContainer(container: HTMLElement, expand: boolean) {
    const animMs = (this as any).hoverDurationMs ?? this.hoverDurationMs ?? 300;
    const startHeight = container.clientHeight;
    const fullHeight = (container.firstElementChild as HTMLElement)?.scrollHeight ?? container.scrollHeight;
    const collapsedHeight = this.read_more_lines > 0 ? Math.round(this.read_more_lines * this.estimateLineHeight(container)) : 0;

    container.style.transition = `height ${animMs}ms ease`;
    if (expand) {
      if (!container.style.height) container.style.height = `${startHeight}px`;
      container.offsetHeight; // force reflow
      container.style.height = `${fullHeight}px`;
      const onEnd = () => {
        container.style.height = 'auto';
        container.style.transition = '';
        container.removeEventListener('transitionend', onEnd);
      };
      container.addEventListener('transitionend', onEnd);
    } else {
      if (!container.style.height || container.style.height === 'auto') {
        container.style.height = `${fullHeight}px`;
      }
      container.offsetHeight;
      container.style.height = collapsedHeight > 0 ? `${collapsedHeight}px` : '';
      const onEnd = () => {
        container.style.transition = '';
        container.removeEventListener('transitionend', onEnd);
      };
      container.addEventListener('transitionend', onEnd);
    }
  }

  private estimateLineHeight(el: HTMLElement): number {
    try {
      const inner = (el.firstElementChild as HTMLElement) || el;
      const cs = window.getComputedStyle(inner);
      let lh = parseFloat(cs.lineHeight as string);
      if (!lh || isNaN(lh)) {
        const fs = parseFloat(cs.fontSize as string) || 16;
        lh = Math.round(fs * 1.2);
      }
      return lh;
    } catch (e) { return 18; }
  }


   ngOnChanges(changes: SimpleChanges): void {
    if (changes['selected_title'] ) {
      // Scroll to the snippet if selected_title changes
      const snippet = this.snippets.find(s => s.title === this.selected_title);
      if (snippet) {
        // console.log('Scrolling to snippet:', snippet.title);
        this.read_more = false
        this.scrollToElement(snippet.title);
      }
    }else{
      this.read_more = true;
    }
  }

  ngOnDestroy(): void {
    try { this.uiSub?.unsubscribe(); } catch (e) { /* ignore */ }
    this.cancelHoverTimer();
  }

  trackById(index: number, item: any) {
    return item.id;
  }

  readMore(snippet: Snippet) {
    // On small/touch devices, if unfold_on_hover is enabled, toggle inline expansion
    if (this.isSmallScreenOrTouch && this.unfold_on_hover) {
      const sid = snippet.id !== undefined && snippet.id !== null ? String(snippet.id) : null;
      if (this.hoveredSnippetId === sid) {
        this.hoveredSnippetId = null;
        this.animateExpandForId(sid ?? undefined, false);
      } else {
        this.hoveredSnippetId = sid;
        this.animateExpandForId(sid ?? undefined, true);
      }
      return;
    }
    // Otherwise keep original behavior: navigate to the snippet page
    if (snippet.pageId === MENU_TITLES.NEWS) {
      this.router.navigate(['/front/news', snippet.title]);
    } else if (snippet.pageId === MENU_TITLES.AUTRES_RDV) {
      this.router.navigate(['/front/tournaments/autres_rdv', snippet.title]);
    } else {
      console.warn('Unknown pageId for readMore navigation:', snippet.pageId);
    }

  }

  scrollToElement(title: string): void {
    // Assumes each snippet element has an id or attribute based on its title
    const element = document.getElementById(title);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

    stringToSafeHtml(htmlString: string) {
    return this.sanitizer.bypassSecurityTrustHtml(htmlString) ;
  }

    // Compute bootstrap row classes from the `row_cols` input (breakpoints settings).
    rowCols(): string[] {
      return formatRowColsClasses(this.row_cols);
    }

}
