import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {  RouterModule } from '@angular/router';

import { FrontComponent } from './front/front/front.component';
import { routes } from './front/front.routes';
import { FrontNavbarComponent } from './front/front-navbar/front-navbar.component';
import { SignInComponent } from './common/authentification/sign-in/sign-in.component';
import {  NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { TournamentsComponent } from './common/tournaments/tournaments/tournaments.component';
import { TournamentComponent } from './common/tournaments/tournament/tournament.component';
import { ToasterComponent } from './common/toaster/components/toaster/toaster.component';
import { ToastService } from './common/services/toast.service';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    NgbDropdownModule,
    ToasterComponent,
    FrontComponent,
    FrontNavbarComponent,
    SignInComponent,
    TournamentsComponent,
    TournamentComponent
  ],
  exports: [
    RouterModule,
    FrontComponent,
    NgbDropdownModule,
    TournamentsComponent,
    TournamentComponent
  ],
})
export class FrontModule { }
