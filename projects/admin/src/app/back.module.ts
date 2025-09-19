import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { routes } from './back/back.routes';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { AdminComponent } from './back/admin/back.component';
import { SnippetsComponent } from './back/site/snippets/snippets.component';
import { FilemgrWindowsComponent } from './back/files/filemgr/filemgr-windows.component';
import { RootVolumeComponent } from './back/files/root-volume/root-volume';
import { RmbracketsPipe } from './common/pipes/rmbrackets.pipe';
import { MoveToEndPipe } from './common/pipes/move-to-end.pipe';

@NgModule({
  declarations: [
    // aucun pipe ou composant non-standalone
  ],
  imports: [
    MoveToEndPipe,
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes),
    NgbDropdownModule,
    DragDropModule,
    AdminComponent,
    SnippetsComponent,
    FilemgrWindowsComponent,
    RootVolumeComponent,
    RmbracketsPipe
  ],
  exports: [
    RouterModule,
    NgbDropdownModule,
    AdminComponent,
    RmbracketsPipe,
    MoveToEndPipe,
    SnippetsComponent,
    FilemgrWindowsComponent,
    RootVolumeComponent
  ],
})
export class BackModule { }
