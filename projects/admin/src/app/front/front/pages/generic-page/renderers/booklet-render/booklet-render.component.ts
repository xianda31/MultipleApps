import { Component, Input, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Snippet } from '../../../../../../common/interfaces/page_snippet.interface';
import { DomSanitizer } from '@angular/platform-browser';

// Animation duration in milliseconds - must match SCSS $page-flip-duration
const PAGE_FLIP_DURATION_MS = 1500; // 1.5s

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
  isFlipping: boolean = false;
  flipDirection: 'left' | 'right' | null = null;
  isLandscape: boolean = window.matchMedia('(orientation: landscape)').matches;
  isMobile: boolean = window.innerWidth < 1400;  // Couvre Galaxy A51 (914px) et Surface Pro 7 (1368px)

  constructor(private sanitizer: DomSanitizer) { }

  @HostListener('window:orientationchange')
  @HostListener('window:resize')
  onOrientationChange(): void {
    this.isLandscape = window.matchMedia('(orientation: landscape)').matches;
    this.isMobile = window.innerWidth < 1400;
  }

  ngOnInit(): void {
    if (this.snippets.length === 0) {
      console.warn('[BookletRenderComponent] Aucun snippet fourni');
    }
  }

  // Retourne les deux pages actuelles (gauche et droite)
  get leftSnippet(): Snippet | null {
    return this.snippets[this.currentIndex] || null;
  }

  get rightSnippet(): Snippet | null {
    return this.currentIndex + 1 < this.snippets.length 
      ? this.snippets[this.currentIndex + 1] 
      : null;
  }

  // Getters for next page pair (visible behind during forward flip)
  get nextLeftSnippet(): Snippet | null {
    return this.snippets[this.currentIndex + 2] || null;
  }

  get nextRightSnippet(): Snippet | null {
    return this.currentIndex + 3 < this.snippets.length 
      ? this.snippets[this.currentIndex + 3] 
      : null;
  }

  // Getters for previous page pair (visible behind during backward flip)
  get prevLeftSnippet(): Snippet | null {
    return this.currentIndex - 2 >= 0 ? this.snippets[this.currentIndex - 2] : null;
  }

  get prevRightSnippet(): Snippet | null {
    return this.currentIndex - 1 >= 0 ? this.snippets[this.currentIndex - 1] : null;
  }

  get hasNext(): boolean {
    const pageIncrement = (this.isMobile && !this.isLandscape) ? 1 : 2;
    return this.currentIndex + pageIncrement < this.snippets.length;
  }

  get hasPrevious(): boolean {
    const pageDecrement = (this.isMobile && !this.isLandscape) ? 1 : 2;
    return this.currentIndex - pageDecrement >= 0;
  }

  get pageNumber(): number {
    return this.currentIndex + 1;
  }

  get totalPages(): number {
    return this.snippets.length;
  }

  // En portrait mobile, pas d'animation 3D => délai minimal
  // En paysage/desktop, animation 3D => délai plein
  private get flipDelay(): number {
    return (this.isMobile && !this.isLandscape) ? 0 : PAGE_FLIP_DURATION_MS;
  }

  next(): void {
    // En mode portrait mobile: avancer d'une page, sinon deux pages (spread)
    const pageIncrement = (this.isMobile && !this.isLandscape) ? 1 : 2;
    const hasNextPage = this.currentIndex + pageIncrement < this.snippets.length;
    
    if (hasNextPage && !this.isFlipping) {
      this.isFlipping = true;
      this.flipDirection = 'right';
      setTimeout(() => {
        this.currentIndex += pageIncrement;
        this.isFlipping = false;
        this.flipDirection = null;
      }, this.flipDelay);
    }
  }

  previous(): void {
    // En mode portrait mobile: reculer d'une page, sinon deux pages (spread)
    const pageDecrement = (this.isMobile && !this.isLandscape) ? 1 : 2;
    const hasPreviousPage = this.currentIndex - pageDecrement >= 0;
    
    if (hasPreviousPage && !this.isFlipping) {
      this.isFlipping = true;
      this.flipDirection = 'left';
      setTimeout(() => {
        this.currentIndex -= pageDecrement;
        this.isFlipping = false;
        this.flipDirection = null;
      }, this.flipDelay);
    }
  }

  goToPage(index: number): void {
    if (index >= 0 && index < this.snippets.length && !this.isFlipping) {
      this.isFlipping = true;
      this.flipDirection = index > this.currentIndex ? 'right' : 'left';
      setTimeout(() => {
        this.currentIndex = index;
        this.isFlipping = false;
        this.flipDirection = null;
      }, this.flipDelay);
    }
  }

  stringToSafeHtml(htmlString: string) {
    return this.sanitizer.bypassSecurityTrustHtml(htmlString);
  }
}

