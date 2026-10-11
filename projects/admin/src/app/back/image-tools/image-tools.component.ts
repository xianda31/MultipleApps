import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { GalleryMgrComponent } from '../maintenance-images/maintenance-images.component';
import { TournamentThumbnailsMgrComponent } from '../tournament-thumbnails-mgr/tournament-thumbnails-mgr.component';
import { VisualIdentityMgrComponent } from '../visual-identity-mgr/visual-identity-mgr.component';

type ImageTool = 'gallery' | 'tournament-thumbnails' | 'visual-identity';

@Component({
  selector: 'app-image-tools',
  standalone: true,
  imports: [CommonModule, GalleryMgrComponent, TournamentThumbnailsMgrComponent, VisualIdentityMgrComponent],
  templateUrl: './image-tools.component.html',
  styleUrl: './image-tools.component.scss',
})
export class ImageToolsComponent {
  activeTool: ImageTool = 'gallery';

  constructor(route: ActivatedRoute) {
    const requestedTool = route.snapshot.queryParamMap.get('tool');
    if (requestedTool === 'visual-identity' || requestedTool === 'tournament-thumbnails') {
      this.activeTool = requestedTool;
    }
  }

  selectTool(tool: ImageTool): void {
    this.activeTool = tool;
  }
}
