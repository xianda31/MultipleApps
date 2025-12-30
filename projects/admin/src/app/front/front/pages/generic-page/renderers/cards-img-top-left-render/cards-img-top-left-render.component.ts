import { AfterViewChecked, AfterViewInit, Component, ElementRef, Input, QueryList, ViewChildren, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MENU_TITLES, Snippet } from '../../../../../../common/interfaces/page_snippet.interface';
import { BreakpointsSettings } from '../../../../../../common/interfaces/ui-conf.interface';
import { Router } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { SystemDataService } from '../../../../../../common/services/system-data.service';
import { NavItemsService } from '../../../../../../common/services/navitem.service';
import { InternalLinkRoutingService } from '../../../../../../common/services/internal-link-routing.service';
import { Subscription } from 'rxjs';
import { formatRowColsClasses } from '../../../../../../common/utils/ui-utils';

@Component({
  selector: 'app-cards-img-top-left-render',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cards-img-top-left-render.component.html',
  styleUrls: ['./cards-img-top-left-render.component.scss']
})
export class CardsImgTopLeftRenderComponent implements AfterViewInit, AfterViewChecked {
      // plus besoin de globalPointerHandlerAttached ici
    private clampLinkHandlers: Array<() => void> = [];
  @Input() row_cols: BreakpointsSettings = { SM: 1, MD: 2, LG: 3, XL: 4 };
  @Input() snippets: Snippet[] = [];
  @ViewChildren('clampContainer') clampContainers!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('clampRef') clampRefs!: QueryList<ElementRef<HTMLElement>>;

  read_more: boolean = true;
  read_more_lines: number = 2;
  private uiSub?: Subscription;
  unfold_on_hover: boolean = false;
  hoveredSnippetId: string | null = null;
  // hover timer id used to delay expansion
  private hoverTimer: any;
  // hover delay in ms (read from UI settings)
  hoverDelayMs: number = 500;
  // hover animation duration (ms)
  hoverDurationMs: number = 300;
  // small screen or touch detection
  isSmallScreenOrTouch: boolean = false;
  // Track if a snippet's text is visually overflowing (clamped)
  private overflowMap: Record<string, boolean> = {};
  private overflowCheckScheduled = false;
   constructor(
    private router: Router,
    private sanitizer: DomSanitizer,
    private systemDataService: SystemDataService,
    private navItemsService: NavItemsService,
    private internalLinkRoutingService: InternalLinkRoutingService
  ) {
    this.updateIsSmallScreenOrTouch();
    this.uiSub = this.systemDataService.get_ui_settings().subscribe((ui: any) => {
      try {
        const rl = (ui && ui.homepage && ui.homepage.read_more_lines) ? ui.homepage.read_more_lines : ui?.read_more_lines;
        this.read_more_lines = (rl !== undefined && rl !== null) ? Number(rl) : 2;
        this.unfold_on_hover = !!(ui && ui.homepage && ui.homepage.unfold_on_hover) || !!ui?.unfold_on_hover;
        this.hoverDelayMs = (ui && ui.homepage && ui.homepage.hover_unfold_delay_ms) ? Number(ui.homepage.hover_unfold_delay_ms) : (ui?.hover_unfold_delay_ms ?? 500);
        this.hoverDurationMs = (ui && ui.homepage && ui.homepage.hover_unfold_duration_ms) ? Number(ui.homepage.hover_unfold_duration_ms) : (ui?.hover_unfold_duration_ms ?? 300);
      } catch (e) { /* ignore */ }
    });
  }

  setHover(id: string | undefined) {
    if (!this.unfold_on_hover || this.isSmallScreenOrTouch) return;
    // delay expansion by 500ms
    this.cancelHoverTimer();
    this.hoverTimer = setTimeout(() => {
      const sid = id !== undefined && id !== null ? String(id) : null;
      this.hoveredSnippetId = sid;
      // animate expansion for this snippet
      this.animateExpandForId(sid ?? undefined, true);
      this.hoverTimer = undefined;
    }, this.hoverDelayMs);
  }

  clearHover() {
    // cancel pending expansion and collapse immediately
    this.cancelHoverTimer();
    if (!this.unfold_on_hover || this.isSmallScreenOrTouch) return;
    const prev = this.hoveredSnippetId;
    this.hoveredSnippetId = null;
    // animate collapse for previously hovered item
    this.animateExpandForId(prev ?? undefined, false);
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

  onTapToggle(id: string | undefined, ev: Event) {
    if (!this.unfold_on_hover || !this.isSmallScreenOrTouch) return;
    ev.stopPropagation();
    this.cancelHoverTimer();
    const sid = id !== undefined && id !== null ? String(id) : null;
    if (this.hoveredSnippetId === sid) {
      this.hoveredSnippetId = null;
      this.animateExpandForId(sid ?? undefined, false);
    } else {
      this.hoveredSnippetId = sid;
      this.animateExpandForId(sid ?? undefined, true);
    }
  }

  isHovered(id: string | undefined): boolean {
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

  getClampStyle(id: string | undefined): { [k: string]: any } {
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

  trackById(index: number, item: any) {
    return item.id;
  }
  ngAfterViewInit() {
    this.scheduleOverflowCheck();
    // Handler global factorisé via le service
    this.internalLinkRoutingService.attachGlobalPointerHandler();
  }

  /**
   * Attache un handler de clic sur chaque clampContainer pour router les liens internes
   */
  private attachInternalLinkHandlersToClampContainers() {
    // Nettoyage des anciens handlers si rechargement
    this.clampLinkHandlers.forEach(off => off());
    this.clampLinkHandlers = [];
    if (!this.clampContainers) return;
    this.clampContainers.forEach(ref => {
      const handler = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (target.tagName === 'A') {
          let href = target.getAttribute('href');
          console.log('[CardsImgTopLeftRender] Click on link:', href);
          if (href && (/^(\/|\.\/|\.\.)/.test(href))) {
            event.preventDefault();
            event.stopPropagation();
            // Normalize relative links
            if (href.startsWith('./')) {
              href = '/' + href.slice(2);
            } else if (href.startsWith('../')) {
              while (href.startsWith('../')) {
                href = href.slice(3);
              }
              href = '/' + href;
            }
            this.router.navigateByUrl(href);
          }
        }
      };
      ref.nativeElement.addEventListener('click', handler, true); // mode capture
      this.clampLinkHandlers.push(() => ref.nativeElement.removeEventListener('click', handler, true));
    });
  }

  ngAfterViewChecked() {
    this.scheduleOverflowCheck();
    this.attachInternalLinkHandlersToClampContainers();
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
    try {
      const duration = this.hoverDelayMs ? this.hoverDelayMs : 300; // fallback, but real duration stored in hoverDelayMs variable for timing; here use hoverDelayMs? we'll use hoverDelayMs as delay; animation duration stored separately in hoverDurationMs
    } catch (e) { /* ignore */ }
    // actual animation uses hoverDurationMs (we read it from settings into hoverDurationMs)
    const animMs = (this as any).hoverDurationMs ?? 300;
    // measure
    const startHeight = container.clientHeight;
    // ensure full height measured
    const fullHeight = (container.firstElementChild as HTMLElement)?.scrollHeight ?? container.scrollHeight;
    const collapsedHeight = this.read_more_lines > 0 ? Math.round(this.read_more_lines * this.estimateLineHeight(container)) : 0;

    // prepare transition
    container.style.transition = `height ${animMs}ms ease`;
    // If expanding: go from current to fullHeight then set to auto
    if (expand) {
      // set explicit start height if auto
      if (!container.style.height) container.style.height = `${startHeight}px`;
      // force reflow
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      container.offsetHeight;
      container.style.height = `${fullHeight}px`;
      const onEnd = () => {
        container.style.height = 'auto';
        container.style.transition = '';
        container.removeEventListener('transitionend', onEnd);
      };
      container.addEventListener('transitionend', onEnd);
    } else {
      // collapsing: set from current (auto) to collapsedHeight
      // ensure we have a pixel start value
      if (!container.style.height || container.style.height === 'auto') {
        container.style.height = `${fullHeight}px`;
      }
      // force reflow
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
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
    readMore(snippet: Snippet) {
    // If on small/touch device and hover-unfold is enabled, expand inline instead of navigating
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
    // Fallback: navigate to snippet-specific page using dynamic path lookup
    if (snippet.pageId) {
      const path = this.navItemsService.getPathByPageTitle(snippet.pageId);
      if (path) {
        this.router.navigate(['/front', path, snippet.title]);
      } else {
        console.warn('No path found for pageId:', snippet.pageId);
      }
    } else {
      console.warn('No pageId for readMore navigation');
    }
    }

    ngOnDestroy(): void {
      try { this.uiSub?.unsubscribe(); } catch (e) { /* ignore */ }
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
