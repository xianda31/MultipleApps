import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Snippet } from '../../../../../../common/interfaces/page_snippet.interface';

@Component({
  selector: 'app-cards-img-bottom-render',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cards-img-bottom-render.component.html',
  styleUrls: ['./cards-img-bottom-render.component.scss']
})
export class CardsImgBottomRenderComponent {
  @Input() snippets: Snippet[] = [];

  trackById(index: number, item: any) {
    return item.id;
  }
}
