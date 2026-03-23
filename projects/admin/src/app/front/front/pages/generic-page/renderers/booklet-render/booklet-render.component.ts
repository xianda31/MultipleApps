import { Component, ElementRef, HostListener, Input, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Snippet } from '../../../../../../common/interfaces/page_snippet.interface';
import { DomSanitizer } from '@angular/platform-browser';

// Fallback durations (animationend is the primary trigger on mobile)
const PAGE_FLIP_DURATION_MS = 3600;      // $page-flip-duration: 3.4s + 200ms safety margin
const PORTRAIT_FLIP_DURATION_MS = 1200;  // $portrait-flip-duration: 1.0s + 200ms safety margin

@Component({
  selector: 'app-booklet-render',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './booklet-render.component.html',
  styleUrls: ['./booklet-render.component.scss']
})
export class BookletRenderComponent implements OnInit {
  @Input() snippets: Snippet[] = [];

  currentIndex: number = 0;
  portraitIndex: number = 0;
  isMobilePortrait: boolean = false;
  isFlipping: boolean = false;
  flipDirection: 'left' | 'right' | null = null;

  // Frozen backdrop content — captured at flip-start, stable throughout the flip + settle phase
  backdropLeft: Snippet | null = null;
  backdropRight: Snippet | null = null;
  backdropPortrait: Snippet | null = null;

  // Pending state to apply once animation truly ends
  private pendingUpdate: (() => void) | null = null;
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private animatingEl: HTMLElement | null = null;

  constructor(private sanitizer: DomSanitizer, private el: ElementRef, private ngZone: NgZone) { }

  ngOnInit(): void {
    if (this.snippets.length === 0) {
      console.warn('[BookletRenderComponent] Aucun snippet fourni');
    }
    this.checkPortraitMode();
  }

  @HostListener('window:resize')
  @HostListener('window:orientationchange')
  onViewportChange(): void {
    this.checkPortraitMode();
  }

  private checkPortraitMode(): void {
    this.isMobilePortrait = window.matchMedia('(max-width: 600px) and (orientation: portrait)').matches;
  }

  /**
   * Starts a flip animation. Finds the animating element by selector,
   * listens for animationend (exact timing), and falls back to a timer.
   * State is applied AFTER the animation truly ends → no snap-flash.
   */
  private startFlip(
    direction: 'left' | 'right',
    animSelector: string,
    fallbackMs: number,
    update: () => void
  ): void {
    this.isFlipping = true;
    this.flipDirection = direction;
    this.pendingUpdate = update;

    // Run outside Angular zone so the listener itself doesn't trigger CD
    this.ngZone.runOutsideAngular(() => {
      // Give Angular one tick to render the animation class before we query
      setTimeout(() => {
        const animEl = (this.el.nativeElement as HTMLElement).querySelector(animSelector) as HTMLElement | null;
        this.animatingEl = animEl;

        let committed = false;
        const commit = () => {
          if (committed || !this.pendingUpdate) return;
          committed = true;
          this.cleanup();

          // Synchronously hide ALL page elements via direct DOM — immediate, no Angular CD latency.
          // This fires BEFORE ngZone.run() so the pages are already hidden when Angular
          // updates leftSnippet/rightSnippet and removes animation classes.
          const hostEl = this.el.nativeElement as HTMLElement;
          const pageEls = Array.from(
            hostEl.querySelectorAll<HTMLElement>('.page-container, .portrait-page')
          );
          pageEls.forEach(el => { el.style.visibility = 'hidden'; });

          // Step 1: advance index while pages are already hidden
          this.ngZone.run(() => {
            this.pendingUpdate!();
            this.pendingUpdate = null;
          });

          // Step 2: 2 rAFs later — reveal pages + dismiss backdrop in the SAME browser paint.
          // At this point: animation fill-mode still hides the flipping page (class still present);
          // clearing inline style + removing animation class both happen before the next paint.
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              pageEls.forEach(el => { el.style.visibility = ''; });
              this.ngZone.run(() => {
                this.isFlipping = false;
                this.flipDirection = null;
              });
            });
          });
        };

        if (animEl) {
          // Known animation names for this component's flip effects
          const flipAnimations = new Set(['flipRightPageOut', 'flipLeftPageOut', 'portraitFlipRight', 'portraitFlipLeft']);

          const onEnd = (e: Event) => {
            const ae = e as AnimationEvent;
            // Only react to our specific flip animation on this exact element.
            // Do NOT use { once: true }: innerHTML content may fire animationend events
            // that bubble up and would remove the listener before our animation fires.
            if (ae.target !== animEl) return;
            if (!flipAnimations.has(ae.animationName)) return;
            commit();
          };
          // No { once: true } — we remove manually in cleanup()
          animEl.addEventListener('animationend', onEnd);
          this.animatingEl = animEl;
          (animEl as any).__flipEndListener = onEnd;
        }

        // Fallback timer in case animationend never fires (throttled tab, etc.)
        this.fallbackTimer = setTimeout(commit, fallbackMs);
      }, 0);
    });
  }

  private cleanup(): void {
    if (this.fallbackTimer !== null) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    if (this.animatingEl) {
      const fn = (this.animatingEl as any).__flipEndListener;
      if (fn) this.animatingEl.removeEventListener('animationend', fn);
      delete (this.animatingEl as any).__flipEndListener;
      this.animatingEl = null;
    }
  }

  // ─── Two-page spread (laptop / landscape) ────────────────────────────

  get leftSnippet(): Snippet | null {
    return this.snippets[this.currentIndex] || null;
  }

  get rightSnippet(): Snippet | null {
    return this.currentIndex + 1 < this.snippets.length
      ? this.snippets[this.currentIndex + 1]
      : null;
  }

  get nextLeftSnippet(): Snippet | null {
    return this.snippets[this.currentIndex + 2] || null;
  }

  get nextRightSnippet(): Snippet | null {
    return this.currentIndex + 3 < this.snippets.length
      ? this.snippets[this.currentIndex + 3]
      : null;
  }

  get prevLeftSnippet(): Snippet | null {
    return this.currentIndex - 2 >= 0 ? this.snippets[this.currentIndex - 2] : null;
  }

  get prevRightSnippet(): Snippet | null {
    return this.currentIndex - 1 >= 0 ? this.snippets[this.currentIndex - 1] : null;
  }

  get hasNext(): boolean {
    return this.currentIndex + 2 < this.snippets.length;
  }

  get hasPrevious(): boolean {
    return this.currentIndex > 0;
  }

  get pageNumber(): number {
    return this.currentIndex + 1;
  }

  get totalPages(): number {
    return this.snippets.length;
  }

  next(): void {
    if (this.hasNext && !this.isFlipping) {
      this.backdropLeft = this.snippets[this.currentIndex + 2] ?? null;
      this.backdropRight = this.snippets[this.currentIndex + 3] ?? null;
      this.startFlip('right', '.right-page.flipping-right', PAGE_FLIP_DURATION_MS, () => {
        this.currentIndex += 2;
        this.portraitIndex = this.currentIndex;
      });
    }
  }

  previous(): void {
    if (this.hasPrevious && !this.isFlipping) {
      this.backdropLeft = this.snippets[this.currentIndex - 2] ?? null;
      this.backdropRight = this.snippets[this.currentIndex - 1] ?? null;
      this.startFlip('left', '.left-page.flipping-left', PAGE_FLIP_DURATION_MS, () => {
        this.currentIndex -= 2;
        this.portraitIndex = this.currentIndex;
      });
    }
  }

  goToPage(index: number): void {
    if (index >= 0 && index < this.snippets.length && !this.isFlipping) {
      const dir = index > this.currentIndex ? 'right' : 'left';
      const sel = dir === 'right' ? '.right-page.flipping-right' : '.left-page.flipping-left';
      this.backdropLeft = this.snippets[index] ?? null;
      this.backdropRight = this.snippets[index + 1] ?? null;
      this.startFlip(dir, sel, PAGE_FLIP_DURATION_MS, () => {
        this.currentIndex = index;
        this.portraitIndex = index;
      });
    }
  }

  // ─── Single-page portrait mode ────────────────────────────────────────

  get portraitSnippet(): Snippet | null {
    return this.snippets[this.portraitIndex] || null;
  }

  get portraitNextSnippet(): Snippet | null {
    return this.snippets[this.portraitIndex + 1] || null;
  }

  get portraitPrevSnippet(): Snippet | null {
    return this.portraitIndex > 0 ? this.snippets[this.portraitIndex - 1] : null;
  }

  get portraitHasNext(): boolean {
    return this.portraitIndex + 1 < this.snippets.length;
  }

  get portraitHasPrevious(): boolean {
    return this.portraitIndex > 0;
  }

  get portraitPageNumber(): number {
    return this.portraitIndex + 1;
  }

  portraitNext(): void {
    if (this.portraitHasNext && !this.isFlipping) {
      this.backdropPortrait = this.snippets[this.portraitIndex + 1] ?? null;
      this.startFlip('right', '.portrait-page.portrait-flipping-right', PORTRAIT_FLIP_DURATION_MS, () => {
        this.portraitIndex++;
        this.currentIndex = Math.floor(this.portraitIndex / 2) * 2;
      });
    }
  }

  portraitPrevious(): void {
    if (this.portraitHasPrevious && !this.isFlipping) {
      this.backdropPortrait = this.snippets[this.portraitIndex - 1] ?? null;
      this.startFlip('left', '.portrait-page.portrait-flipping-left', PORTRAIT_FLIP_DURATION_MS, () => {
        this.portraitIndex--;
        this.currentIndex = Math.floor(this.portraitIndex / 2) * 2;
      });
    }
  }

  portraitGoToPage(index: number): void {
    if (index >= 0 && index < this.snippets.length && index !== this.portraitIndex && !this.isFlipping) {
      const dir = index > this.portraitIndex ? 'right' : 'left';
      const sel = dir === 'right' ? '.portrait-page.portrait-flipping-right' : '.portrait-page.portrait-flipping-left';
      this.backdropPortrait = this.snippets[index] ?? null;
      this.startFlip(dir, sel, PORTRAIT_FLIP_DURATION_MS, () => {
        this.portraitIndex = index;
        this.currentIndex = Math.floor(index / 2) * 2;
      });
    }
  }

  stringToSafeHtml(htmlString: string) {
    return this.sanitizer.bypassSecurityTrustHtml(htmlString);
  }
}

