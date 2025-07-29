import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { FrontComponent } from './front/front.component';
import { routes } from './front.routes';
import { FrontNavbarComponent } from './front-navbar/front-navbar.component';



@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    FrontComponent,
    FrontNavbarComponent
  ],
  exports: [
    FrontComponent,
  ],
})
export class FrontModule { }
