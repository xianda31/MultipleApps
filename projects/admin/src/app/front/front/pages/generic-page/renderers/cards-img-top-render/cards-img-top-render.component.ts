import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Snippet } from '../../../../../../common/interfaces/page_snippet.interface';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-cards-img-top-render',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cards-img-top-render.component.html',
  styleUrls: ['./cards-img-top-render.component.scss']
})
export class CardsImgTopRenderComponent {
  @Input() snippets: Snippet[] = [];
  constructor(private sanitizer: DomSanitizer) { }

  trackById(index: number, item: any) {
    return item.id;
  }

    stringToSafeHtml(htmlString: string) {
    return this.sanitizer.bypassSecurityTrustHtml(htmlString) ;
  }
}
