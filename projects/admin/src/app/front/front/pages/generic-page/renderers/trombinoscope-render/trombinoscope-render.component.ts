import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Snippet } from '../../../../../../common/interfaces/page_snippet.interface';

@Component({
  selector: 'app-trombinoscope-render',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './trombinoscope-render.component.html',
  styleUrls: ['./trombinoscope-render.component.scss']
})
export class TrombinoscopeRenderComponent {
  @Input() snippets: Snippet[] = [];

  trackById(index: number, item: any) {
    return item.id;
  }
}
