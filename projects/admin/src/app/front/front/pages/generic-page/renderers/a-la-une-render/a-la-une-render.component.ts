import { Component, Input, OnChanges, SimpleChanges, OnDestroy, AfterViewInit, AfterViewChecked, ElementRef, QueryList, ViewChildren, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MENU_TITLES, Snippet } from '../../../../../../common/interfaces/page_snippet.interface';
import { BreakpointsSettings } from '../../../../../../common/interfaces/ui-conf.interface';
import { Router } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { SystemDataService } from '../../../../../../common/services/system-data.service';
import { NavItemsService } from '../../../../../../common/services/navitem.service';
import { InternalLinkRoutingService } from '../../../../../../common/services/internal-link-routing.service';
import { Subscription } from 'rxjs';
import { attachExternalLinkHandler } from '../../utils/util_click_handler';
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
  read_more_lines: number = 3;
  TRUNCATE_LIMIT = 300;
  TRUNCATE_HYSTERISIS = 50;
  private uiSub?: Subscription;
  
  // Expand/collapse settings from UI
  unfold_on_hover: boolean = false;
  hoverDelayMs: number = 500;
  hoverDurationMs: number = 600;
  
  // Per-snippet state: track which snippets are expanded
  private expandedSnippets = new Set<string>();
  
  // Per-snippet timers: hover and collapse delays
  private snippetHoverTimers = new Map<string, any>();
  private snippetCollapseTimers = new Map<string, any>();
  
  // small screen or touch detection
  isSmallScreenOrTouch: boolean = false;
  // touch device detection (independent of orientation)
  isTouchDevice: boolean = false;
  @ViewChildren('clampContainer') clampContainers!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('clampRef') clampRefs!: QueryList<ElementRef<HTMLElement>>;

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
    // subscribe to UI settings
    this.uiSub = this.systemDataService.get_ui_settings().subscribe((ui: any) => {
      try {
        const rl = (ui && ui.homepage && ui.homepage.read_more_lines) ? ui.homepage.read_more_lines : ui?.read_more_lines ?? 3;
        this.read_more_lines = (rl !== undefined && rl !== null) ? Number(rl) : 3;
        this.TRUNCATE_LIMIT = Math.max(0, Math.round(this.read_more_lines * 120));
        
        // Get expand/collapse settings from UI
        this.unfold_on_hover = !!(ui && ui.homepage && ui.homepage.unfold_on_hover) || !!ui?.unfold_on_hover;
        this.hoverDelayMs = (ui && ui.homepage && ui.homepage.hover_unfold_delay_ms) ? Number(ui.homepage.hover_unfold_delay_ms) : (ui?.hover_unfold_delay_ms ?? 500);
        this.hoverDurationMs = (ui && ui.homepage && ui.homepage.hover_unfold_duration_ms) ? Number(ui.homepage.hover_unfold_duration_ms) : (ui?.hover_unfold_duration_ms ?? 600);
      } catch (e) { /* ignore */ }
    });
  }

  setHover(id: any) {
    if (!this.unfold_on_hover) return;
    const snippetId = id !== undefined && id !== null ? String(id) : null;
    if (!snippetId) return;
    
    // Cancel any pending collapse timer
    this.cancelCollapseTimer(snippetId);
    
    // If already expanded, do nothing
    if (this.expandedSnippets.has(snippetId)) return;
    
    // Cancel any previous hover timer
    this.cancelHoverTimer(snippetId);
    
    // Schedule expansion after delay
    const timer = setTimeout(() => {
      this.expandedSnippets.add(snippetId);
      this.snippetHoverTimers.delete(snippetId);
      this.animateExpand(snippetId);
    }, this.hoverDelayMs);
    
    this.snippetHoverTimers.set(snippetId, timer);
  }

  clearHover(id: any) {
    if (!this.unfold_on_hover) return;
    const snippetId = id !== undefined && id !== null ? String(id) : null;
    if (!snippetId) return;
    
    // Cancel pending hover expansion
    this.cancelHoverTimer(snippetId);
    
    // If not expanded, do nothing
    if (!this.expandedSnippets.has(snippetId)) return;
    
    // Cancel any previous collapse timer
    this.cancelCollapseTimer(snippetId);
    
    // Schedule collapse with animation
    const timer = setTimeout(() => {
      this.expandedSnippets.delete(snippetId);
      this.snippetCollapseTimers.delete(snippetId);
      this.animateCollapse(snippetId);
    }, this.hoverDelayMs);
    
    this.snippetCollapseTimers.set(snippetId, timer);
  }

  private cancelHoverTimer(snippetId: string) {
    const timer = this.snippetHoverTimers.get(snippetId);
    if (timer) {
      clearTimeout(timer);
      this.snippetHoverTimers.delete(snippetId);
    }
  }

  private cancelCollapseTimer(snippetId: string) {
    const timer = this.snippetCollapseTimers.get(snippetId);
    if (timer) {
      clearTimeout(timer);
      this.snippetCollapseTimers.delete(snippetId);
    }
  }

  isExpanded(id: any): boolean {
    if (!this.unfold_on_hover) return false;
    const snippetId = id !== undefined && id !== null ? String(id) : null;
    return snippetId !== null && this.expandedSnippets.has(snippetId);
  }

  getClampStyle(id: any): { [k: string]: any } {
    const expanded = this.isExpanded(id);
    if (expanded) {
      return { 'display': 'block', 'overflow': 'visible' };
    }
    return {
      'display': '-webkit-box',
      '-webkit-box-orient': 'vertical',
      '-webkit-line-clamp': String(this.read_more_lines),
      'overflow': 'hidden'
    };
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.updateIsSmallScreenOrTouch();
  }

  @HostListener('window:touchstart')
  onFirstTouch() {
    this.updateIsSmallScreenOrTouch();
  }

  private updateIsSmallScreenOrTouch() {
    try {
      const mq = window.matchMedia('(max-width: 768px)');
      const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) || (navigator as any).msMaxTouchPoints > 0;
      const isMobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
      const isPortrait = (typeof window.innerHeight === 'number' && typeof window.innerWidth === 'number') ? window.innerHeight > window.innerWidth : false;
      
      // Set touch device (independent of orientation)
      this.isTouchDevice = !!hasTouch || isMobileUA;
      
      // Set small screen or touch (requires portrait for touch)
      this.isSmallScreenOrTouch = !!hasTouch && isPortrait && (mq.matches || isMobileUA);
    } catch (e) { 
      this.isSmallScreenOrTouch = false;
      this.isTouchDevice = false;
    }
  }

  ngAfterViewInit() {
    this.scheduleOverflowCheck();
    // Handler global factorisé via le service
    this.internalLinkRoutingService.attachGlobalPointerHandler();
    this.attachLinkHandlers();
  }

  ngAfterViewChecked() {
    this.scheduleOverflowCheck();
    this.attachLinkHandlers();
  }

  private attachLinkHandlers() {
    if (!this.clampRefs) return;
    this.clampRefs.forEach(ref => {
      const root: HTMLElement = ref.nativeElement as HTMLElement;
      attachExternalLinkHandler(root);
    });
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

  private findContainerById(id: string): HTMLElement | null {
    const idx = this.snippets.findIndex(s => String(s.id) === String(id));
    const arr = this.clampContainers ? this.clampContainers.toArray() : [];
    if (idx >= 0 && idx < arr.length) return arr[idx].nativeElement as HTMLElement;
    return null;
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
    
    // Clean up all timers for all snippets
    this.snippetHoverTimers.forEach((timer) => {
      try { clearTimeout(timer); } catch (e) { /* ignore */ }
    });
    this.snippetHoverTimers.clear();
    
    this.snippetCollapseTimers.forEach((timer) => {
      try { clearTimeout(timer); } catch (e) { /* ignore */ }
    });
    this.snippetCollapseTimers.clear();
  }

  trackById(index: number, item: any) {
    return item.id;
  }

  readMore(snippet: Snippet) {
    const snippetId = snippet.id !== undefined && snippet.id !== null ? String(snippet.id) : null;
    if (!snippetId) return;
    
    // If unfold_on_hover is disabled, navigate to the snippet page
    if (!this.unfold_on_hover) {
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
      return;
    }
    
    // If unfold_on_hover is enabled, toggle expansion
    this.cancelCollapseTimer(snippetId);
    this.cancelHoverTimer(snippetId);
    
    if (this.expandedSnippets.has(snippetId)) {
      // Already expanded, collapse it
      this.expandedSnippets.delete(snippetId);
      this.animateCollapse(snippetId);
    } else {
      // Not expanded, expand it immediately
      this.expandedSnippets.add(snippetId);
      this.animateExpand(snippetId);
    }
  }

  private animateExpand(snippetId: string) {
    const container = this.findContainerById(snippetId);
    if (!container) return;
    
    const span = container.querySelector('span.card-text') as HTMLElement;
    if (!span) return;
    
    // Get the clamped (current) height
    const clampedHeight = this.measureClampedHeight(container);
    
    // Temporarily remove clamping styles to measure full height
    const originalDisplay = span.style.display;
    const originalBoxOrient = (span.style as any).webkitBoxOrient;
    const originalLineClamp = (span.style as any).webkitLineClamp;
    const originalOverflow = span.style.overflow;
    
    span.style.display = 'block';
    (span.style as any).webkitBoxOrient = '';
    (span.style as any).webkitLineClamp = '';
    span.style.overflow = 'visible';
    
    // Force reflow to get accurate height
    span.offsetHeight;
    const fullHeight = span.scrollHeight;
    
    // Restore original styles
    span.style.display = originalDisplay;
    (span.style as any).webkitBoxOrient = originalBoxOrient;
    (span.style as any).webkitLineClamp = originalLineClamp;
    span.style.overflow = originalOverflow;
    
    // Set explicit starting height (clamped)
    container.style.height = `${clampedHeight}px`;
    container.style.transition = '';
    
    // Trigger reflow to ensure height is set
    container.offsetHeight;
    
    // Now animate to full height with smooth progression
    const animDuration = this.hoverDurationMs ?? 600;
    container.style.transition = `height ${animDuration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
    container.style.height = `${fullHeight}px`;
    
    const onEnd = () => {
      container.style.height = 'auto';
      container.style.transition = '';
      container.removeEventListener('transitionend', onEnd);
    };
    container.addEventListener('transitionend', onEnd, { once: true });
  }

  private animateCollapse(snippetId: string) {
    const container = this.findContainerById(snippetId);
    if (!container) return;
    
    const animDuration = this.hoverDurationMs ?? 600;
    const clampedHeight = this.measureClampedHeight(container);
    
    // Set explicit current height before transition
    container.style.height = `${container.clientHeight}px`;
    container.style.transition = '';
    
    // Trigger reflow to ensure height is set
    container.offsetHeight;
    
    // Now animate to clamped height
    container.style.transition = `height ${animDuration}ms ease-in`;
    container.style.height = `${clampedHeight}px`;
    
    const onEnd = () => {
      container.style.transition = '';
      container.style.height = '';
      container.removeEventListener('transitionend', onEnd);
    };
    container.addEventListener('transitionend', onEnd, { once: true });
  }

  private measureClampedHeight(container: HTMLElement): number {
    const span = container.querySelector('span.card-text') as HTMLElement;
    if (!span) return 0;
    
    // Save current styles
    const originalDisplay = span.style.display;
    const originalBoxOrient = (span.style as any).webkitBoxOrient;
    const originalLineClamp = (span.style as any).webkitLineClamp;
    const originalOverflow = span.style.overflow;
    
    // Apply clamping styles
    (span.style as any).display = '-webkit-box';
    (span.style as any).webkitBoxOrient = 'vertical';
    (span.style as any).webkitLineClamp = String(this.read_more_lines);
    span.style.overflow = 'hidden';
    
    // Force reflow
    span.offsetHeight;
    const height = span.clientHeight;
    
    // Restore original styles
    span.style.display = originalDisplay || '';
    (span.style as any).webkitBoxOrient = originalBoxOrient || '';
    (span.style as any).webkitLineClamp = originalLineClamp || '';
    span.style.overflow = originalOverflow || '';
    
    return height;
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
