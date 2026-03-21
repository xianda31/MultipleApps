import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Snippet } from '../../../../../../common/interfaces/page_snippet.interface';
import { DomSanitizer } from '@angular/platform-browser';

// Animation duration in milliseconds - must match SCSS $page-flip-duration
const PAGE_FLIP_DURATION_MS = 3400; // 3.4s

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

  constructor(private sanitizer: DomSanitizer) { }

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
      this.isFlipping = true;
      this.flipDirection = 'right';
      setTimeout(() => {
        this.currentIndex += 2;
        this.isFlipping = false;
        this.flipDirection = null;
      }, PAGE_FLIP_DURATION_MS);
    }
  }

  previous(): void {
    if (this.hasPrevious && !this.isFlipping) {
      this.isFlipping = true;
      this.flipDirection = 'left';
      setTimeout(() => {
        this.currentIndex -= 2;
        this.isFlipping = false;
        this.flipDirection = null;
      }, PAGE_FLIP_DURATION_MS);
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
      }, PAGE_FLIP_DURATION_MS);
    }
  }

  stringToSafeHtml(htmlString: string) {
    return this.sanitizer.bypassSecurityTrustHtml(htmlString);
  }
}

