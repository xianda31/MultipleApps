import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CloneDBComponent } from './clone-DB/clone-db.component';
import { routes } from './maintenance.routes';
import { FormsModule } from '@angular/forms';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes)
  ],
  declarations: [
    CloneDBComponent
  ],
  exports: [
    CloneDBComponent
  ],
})
export class CloneDBModule { }
