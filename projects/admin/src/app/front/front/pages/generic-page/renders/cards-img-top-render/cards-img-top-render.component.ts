import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Snippet } from '../../../../../../common/interfaces/page_snippet.interface';

@Component({
  selector: 'app-cards-img-top-render',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cards-img-top-render.component.html',
  styleUrls: ['./cards-img-top-render.component.scss']
})
export class CardsImgTopRenderComponent {
  @Input() snippets: Snippet[] = [];

  trackById(index: number, item: any) {
    return item.id;
  }
}
