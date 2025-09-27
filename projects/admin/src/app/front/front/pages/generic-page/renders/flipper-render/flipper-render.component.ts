import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Snippet } from '../../../../../../common/interfaces/page_snippet.interface';

@Component({
  selector: 'app-flipper-render',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './flipper-render.component.html',
  styleUrls: ['./flipper-render.component.scss']
})
export class FlipperRenderComponent {
  @Input() snippets: Snippet[] = [];
  @Input() currentIndex: number = 0;

  trackById(index: number, item: any) {
    return item.id;
  }
}
