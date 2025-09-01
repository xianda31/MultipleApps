import { Routes } from '@angular/router';
import { FrontComponent } from './front/front.component';
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

export const routes: Routes = [
  { path: '',
     component: FrontComponent,
     children: [
      //  {path : 'news', component: NewsComponent },
       {path : 'news', component: GenericPageComponent, data: { menu_title: MENU_TITLES.NEWS } },

       {path : 'club/acteurs', component: GenericPageComponent, data: { menu_title: MENU_TITLES.ACTEURS } },
       {path : 'club/documents', component: GenericPageComponent, data: { menu_title: MENU_TITLES.DOCUMENTS } },
       {path : 'club/bureau', component: GenericPageComponent, data: { menu_title: MENU_TITLES.BUREAU } },

       { path: 'école/cours', component: GenericPageComponent, data: { menu_title: MENU_TITLES.COURS }},
       { path: 'école/inscription', component: PageInConstructionComponent },
       
       {path : 'tournaments/next', component: TournamentsComponent},
       { path: 'tournaments/next/:id', component: TournamentComponent },
       {path : 'tournaments/fees', component: GameCardsOwnedComponent},
       
      { path: 'achats/historique', component: PurchasesComponent },

      { path: 'authentification', component: ConnexionComponent},
      
      { path: '', component: FrontPageComponent },
      { path: '**', component: PageNotFoundComponent },
     ]
   },
];