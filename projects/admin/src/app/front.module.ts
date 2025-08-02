import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {  RouterModule } from '@angular/router';

import { FrontComponent } from './front/front/front.component';
import { routes } from './front/front.routes';
import { FrontNavbarComponent } from './front/front-navbar/front-navbar.component';
import { SignInComponent } from './common/authentification/sign-in/sign-in.component';
import {  NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    NgbDropdownModule,
    FrontComponent,
    FrontNavbarComponent,
    SignInComponent
  ],
  exports: [
    RouterModule,
    FrontComponent,
    NgbDropdownModule
  ],
})
export class FrontModule { }
