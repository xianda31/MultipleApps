import { ExternalRedirectComponent } from './front/external-redirect/external-redirect.component';
import { Routes } from '@angular/router';
import { PageNotFoundComponent } from '../common/page-not-found/page-not-found.component';
import { ConnexionComponent } from '../common/authentification/connexion/connexion.component';
import { TournamentComponent } from '../common/tournaments/tournament/tournament.component';
import { PurchasesComponent } from './purchases/purchases.component';
import { GameCardsOwnedComponent } from './game-cards-owned/game-cards-owned.component';
import { FrontComponent } from './front/front/front.component';
import { Carousel } from './carousel/carousel';
import { HomePage } from './front/pages/home-page/home-page';
import { CustomRouter } from './front/pages/custom-router/custom-router';
import { TournamentsComponent } from '../common/tournaments/tournaments/tournaments.component';



export const routes: Routes = [
  {
    path: '',
    component: FrontComponent,
    children: [


      { path: 'home', component: HomePage },
      { path: 'tournaments/next', component: TournamentsComponent },
      { path: 'tournaments/resultats_ffb', component: ExternalRedirectComponent, data: { site: 'FFB' } },
      { path: 'ffb_dashboard', component: ExternalRedirectComponent, data: { site: 'FFB_dashboard' } },
      // { path: 'tournaments/resultats_royrene', component: ExternalRedirectComponent, data: { site : 'RoyRené' } },
      { path: 'tournaments/:id', component: TournamentComponent },
      { path: 'achats/historique', component: PurchasesComponent },
      { path: 'achats/carte', component: GameCardsOwnedComponent },
      { path: 'albums/:snippet_id', component: Carousel },
      { path: 'authentification', component: ConnexionComponent },
      // { path: 'contacts', component: ContactsComponent },
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      { path: '404', component: PageNotFoundComponent },
      { path: '**', component: CustomRouter },  // catch-all route to handle custom routing
    ]
  },
];