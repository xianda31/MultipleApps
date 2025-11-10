import { NgModule } from '@angular/core';
import { CommonModule as AngularCommonModule } from '@angular/common';
import { SharedModule } from './common/shared.module';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { routes } from './back/back.routes';
// All route components are now standalone; no need to import them here.

@NgModule({
  declarations: [
    // aucun pipe ou composant non-standalone
  ],
  imports: [
    AngularCommonModule,
    FormsModule,
    RouterModule.forChild(routes),
    SharedModule // keep for non-standalone pipes/services still declared there
  ],
})
export class BackModule { }
