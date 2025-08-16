import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { FrontComponent } from './front/front/front.component';
import { FrontNavbarComponent } from './front/front-navbar/front-navbar.component';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { TournamentsComponent } from './common/tournaments/tournaments/tournaments.component';
import { ToasterComponent } from './common/toaster/components/toaster/toaster.component';

import { routes } from './front/front.routes';
import { PurchasesComponent } from './front/purchases/purchases.component';
import { GameCardsOwnedComponent } from './front/game-cards-owned/game-cards-owned.component';
import { TitleComponent } from './front/title/title.component';
import { FonctionnementComponent } from './front/static/fonctionnement/fonctionnement.component';
import { ActorsComponent } from './front/static/actors/actors.component';
import { EnseignantsComponent } from './front/static/enseignants/enseignants.component';

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
    PurchasesComponent,
    GameCardsOwnedComponent,
    TitleComponent,
    FonctionnementComponent,
    ActorsComponent,
    EnseignantsComponent
  ],
  exports: [
    CommonModule,
    RouterModule,
    FrontComponent,
    NgbDropdownModule,
    TournamentsComponent,
    PurchasesComponent,
    GameCardsOwnedComponent,
    TitleComponent,
    FonctionnementComponent,
    ActorsComponent,
    EnseignantsComponent


  ],
})
export class FrontModule { }
