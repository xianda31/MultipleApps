import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Snippet } from '../../../../../../common/interfaces/page_snippet.interface';

@Component({
  selector: 'app-sequential-render',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sequential-render.component.html',
  styleUrls: ['./sequential-render.component.scss']
})
export class SequentialRenderComponent {
  @Input() snippets: Snippet[] = [];

  trackById(index: number, item: any) {
    return item.id;
  }
}
