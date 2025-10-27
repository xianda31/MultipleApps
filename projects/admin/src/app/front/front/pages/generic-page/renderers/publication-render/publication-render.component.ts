import { ChangeDetectorRef, Component, ElementRef, Input, QueryList, ViewChildren, AfterViewInit, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Snippet } from '../../../../../../common/interfaces/page_snippet.interface';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-publication-render',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './publication-render.component.html',
  styleUrls: ['./publication-render.component.scss']
})
export class PublicationRenderComponent implements AfterViewInit, AfterViewChecked {
  @Input() snippets: Snippet[] = [];
  @ViewChildren('textRef') textRefs!: QueryList<ElementRef>;
  textHeights: { [id: string]: number } = {};

  constructor(
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) { }

  trackById(index: number, item: any) {
    return item.id;
  }

  ngAfterViewInit() {
    this.updateTextHeights();
  }

  ngAfterViewChecked() {
    this.updateTextHeights();
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

    scrollTo(title: string) {
    setTimeout(() => {
      const element = document.getElementById(title);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 0);
  }

  clampHeight(h?: number) {
    const val = typeof h === 'number' && !isNaN(h) ? h : 100;
    return Math.min(val, 100);
  }

  stringToSafeHtml(htmlString: string) {
    return this.sanitizer.bypassSecurityTrustHtml(htmlString) ;
  }

  

}
