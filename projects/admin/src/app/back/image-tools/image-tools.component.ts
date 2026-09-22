import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

import { GalleryMgrComponent } from '../maintenance-images/maintenance-images.component';
import { TournamentThumbnailsMgrComponent } from '../tournament-thumbnails-mgr/tournament-thumbnails-mgr.component';

type ImageTool = 'gallery' | 'tournament-thumbnails';

@Component({
  selector: 'app-image-tools',
  standalone: true,
  imports: [CommonModule, GalleryMgrComponent, TournamentThumbnailsMgrComponent],
  templateUrl: './image-tools.component.html',
  styleUrl: './image-tools.component.scss',
})
export class ImageToolsComponent {
  activeTool: ImageTool = 'gallery';

  selectTool(tool: ImageTool): void {
    this.activeTool = tool;
  }
}
