import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Snippet } from '../../../../../../common/interfaces/page_snippet.interface';

@Component({
  selector: 'app-a-la-une-render',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './a-la-une-render.component.html',
  styleUrls: ['./a-la-une-render.component.scss']
})
export class ALaUneRenderComponent {
  @Input() snippets: Snippet[] = [];

  trackById(index: number, item: any) {
    return item.id;
  }
}
