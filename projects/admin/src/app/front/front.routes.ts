import { Routes } from '@angular/router';
import { PageNotFoundComponent } from '../common/page-not-found/page-not-found.component';
import { ConnexionComponent } from '../common/authentification/connexion/connexion.component';
import { TournamentComponent } from '../common/tournaments/tournament/tournament.component';
import { PurchasesComponent } from './purchases/purchases.component';
import { GameCardsOwnedComponent } from './game-cards-owned/game-cards-owned.component';
import { ContactsComponent } from './front/pages/contacts/contacts.component';
import { MENU_TITLES } from '../common/interfaces/page_snippet.interface';
import { FrontComponent } from './front/front/front.component';
import { Carousel } from './carousel/carousel';
import { HomePage } from './front/pages/home-page/home-page';
import { GenericPageComponent } from './front/pages/generic-page/generic-page.component';
import { CustomRouter } from './front/pages/custom-router/custom-router';
import { TournamentsComponent } from '../common/tournaments/tournaments/tournaments.component';



export const routes: Routes = [
  {
    path: '',
    component: FrontComponent,
    children: [
      // { path: 'club/acteurs', component: GenericPageComponent, data: { menu_title: MENU_TITLES.ACTEURS } },
      // { path: 'club/documents', component: GenericPageComponent, data: { menu_title: MENU_TITLES.DOCUMENTS } },
      // { path: 'club/bureau', component: GenericPageComponent, data: { menu_title: MENU_TITLES.BUREAU } },
      // { path: 'école/cours', component: GenericPageComponent, data: { menu_title: MENU_TITLES.COURS } },
      // { path: 'news/:title', component: GenericPageComponent, data: { menu_title: MENU_TITLES.NEWS  } },
      // { path: 'albums', component: GenericPageComponent, data: { menu_title: MENU_TITLES.ALBUMS } },

      { path: 'home', component: HomePage },
      { path: 'tournaments/next', component: TournamentsComponent },
      { path: 'tournaments/:id', component: TournamentComponent },
      { path: 'achats/historique', component: PurchasesComponent },
      { path: 'achats/carte', component: GameCardsOwnedComponent },
      { path: 'albums/:snippet_id', component: Carousel },
      { path: 'authentification', component: ConnexionComponent },
      { path: 'contacts', component: ContactsComponent },
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      {path: '404', component: PageNotFoundComponent },
      { path: '**', component: CustomRouter },
    ]
  },
];