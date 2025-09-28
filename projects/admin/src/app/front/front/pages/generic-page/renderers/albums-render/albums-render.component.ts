import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Snippet } from '../../../../../../common/interfaces/page_snippet.interface';
import { AlbumComponent } from '../../../../../album/album.component';

@Component({
  selector: 'app-albums-render',
  standalone: true,
  imports: [CommonModule,AlbumComponent],
  templateUrl: './albums-render.component.html',
  styleUrls: ['./albums-render.component.scss']
})
export class AlbumsRenderComponent {
  @Input() snippets: Snippet[] = [];

  trackById(index: number, item: any) {
    return item.id;
  }
}
