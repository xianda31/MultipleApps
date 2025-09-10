import { Routes, UrlSegment, Route } from '@angular/router';
import { PageNotFoundComponent } from '../common/page-not-found/page-not-found.component';
import { ConnexionComponent } from '../common/authentification/connexion/connexion.component';
import { TournamentComponent } from '../common/tournaments/tournament/tournament.component';
import { PurchasesComponent } from './purchases/purchases.component';
import { GameCardsOwnedComponent } from './game-cards-owned/game-cards-owned.component';
import { TournamentsComponent } from '../common/tournaments/tournaments/tournaments.component';
import { FrontPageComponent } from './static/front-page/front-page.component';
import { PageInConstructionComponent } from '../common/page-in-construction/page-in-construction.component';
import { GenericPageComponent } from './static/generic-page/generic-page.component';
import { MENU_TITLES } from '../common/interfaces/page_snippet.interface';
import { AlbumComponent } from './album/album.component';
import { FrontComponent } from './front/front.component';


// WORK-AROUND : Angular 20.2.2  looks not supporting multi-segment parameters in routes.
// Custom matcher for multi-segment albums route
export function albumsMatcher(segments: UrlSegment[]) {
  if (segments.length >= 2 && segments[0].path === 'albums') {
    // Join all segments after 'albums/' as the album path
    return {
      consumed: segments,
      posParams: {
        path: new UrlSegment(segments.slice(1).map(s => s.path).join('/'), {})
      }
    };
  }
  return null;
}

export const routes: Routes = [
  {
    path: '',
    component: FrontComponent,
    children: [
      { path: 'news', component: GenericPageComponent, data: { menu_title: MENU_TITLES.NEWS } },
      { path: 'club/acteurs', component: GenericPageComponent, data: { menu_title: MENU_TITLES.ACTEURS } },
      { path: 'club/documents', component: GenericPageComponent, data: { menu_title: MENU_TITLES.DOCUMENTS } },
      { path: 'club/bureau', component: GenericPageComponent, data: { menu_title: MENU_TITLES.BUREAU } },
      { path: 'école/cours', component: GenericPageComponent, data: { menu_title: MENU_TITLES.COURS } },
      { path: 'école/inscription', component: PageInConstructionComponent },
      { path: 'tournaments/next', component: TournamentsComponent },
      { path: 'tournaments/next/:id', component: TournamentComponent },
      { path: 'tournaments/fees', component: GameCardsOwnedComponent },
      { path: 'achats/historique', component: PurchasesComponent },
      {
        matcher: albumsMatcher,
        component: AlbumComponent
      },
      { path: 'authentification', component: ConnexionComponent },
      { path: '', component: FrontPageComponent },
      { path: '**', component: PageNotFoundComponent },
    ]
  },
];