import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {  RouterModule } from '@angular/router';

import { FrontComponent } from './front/front.component';
import { routes } from './front.routes';
import { FrontNavbarComponent } from './front-navbar/front-navbar.component';
import { SharedModule } from '../common/shared.module';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    SharedModule,
    FrontComponent,
    FrontNavbarComponent,
  ],
  exports: [
    RouterModule,
    FrontComponent,
  ],
})
export class FrontModule { }
