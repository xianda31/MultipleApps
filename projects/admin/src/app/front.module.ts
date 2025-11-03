import { ExternalRedirectComponent } from './front/front/external-redirect/external-redirect.component';
import { AlbumComponent } from './front/album/album.component';
import { Carousel } from './front/carousel/carousel';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from './common/shared.module';
import { RouterModule, Routes, ROUTES } from '@angular/router';

import { FrontComponent } from './front/front/front/front.component';
import { FrontNavbarComponent } from './front/front-navbar/front-navbar.component';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { TournamentsComponent } from './common/tournaments/tournaments/tournaments.component';
import { ToasterComponent } from './common/toaster/components/toaster/toaster.component';

import { PurchasesComponent } from './front/purchases/purchases.component';
import { GameCardsOwnedComponent } from './front/game-cards-owned/game-cards-owned.component';
import { TitleComponent } from './front/title/title.component';


// Fonction d'accès aux routes dynamiques
export function navitemRoutesFactory(dynamicRoutesService: DynamicRoutesService): Routes {
  return dynamicRoutesService.getRoutes();
}

import { DynamicRoutesService } from './common/services/dynamic-routes.service';

@NgModule({
  declarations: [
  ],
  imports: [
  CommonModule,
  SharedModule,
    RouterModule.forChild([]),
    NgbDropdownModule,
    ToasterComponent,
    FrontComponent,
    FrontNavbarComponent,
    TournamentsComponent,
    PurchasesComponent,
    GameCardsOwnedComponent,
    TitleComponent,
    ExternalRedirectComponent,
    AlbumComponent,
    Carousel
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
    ExternalRedirectComponent,
    AlbumComponent,
    Carousel
  ],
  providers:[
    {provide: ROUTES,
      useFactory: navitemRoutesFactory,
      deps: [DynamicRoutesService],
      multi: true
    },
  ]
})
export class FrontModule { }
