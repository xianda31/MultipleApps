import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {  RouterModule } from '@angular/router';

import { FrontComponent } from './front/front/front.component';
import { FrontNavbarComponent } from './front/front-navbar/front-navbar.component';
import {  NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { TournamentsComponent } from './common/tournaments/tournaments/tournaments.component';
import { ToasterComponent } from './common/toaster/components/toaster/toaster.component';

import { routes } from './front/front.routes';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    NgbDropdownModule,
    ToasterComponent,
    FrontComponent,
    FrontNavbarComponent,
    TournamentsComponent,
  ],
  exports: [
    CommonModule,
    RouterModule,
    FrontComponent,
    NgbDropdownModule,
    TournamentsComponent,
  ],
})
export class FrontModule { }
