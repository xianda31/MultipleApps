import { Routes } from '@angular/router';
import { FrontComponent } from './front/front.component';
import { PageNotFoundComponent } from '../common/page-not-found/page-not-found.component';
import { ConnexionComponent } from '../common/authentification/connexion/connexion.component';
import { TournamentComponent } from '../common/tournaments/tournament/tournament.component';
import { PurchasesComponent } from './purchases/purchases.component';
import { GameCardsOwnedComponent } from './game-cards-owned/game-cards-owned.component';
import { TournamentsComponent } from '../common/tournaments/tournaments/tournaments.component';
import { FonctionnementComponent } from './static/fonctionnement/fonctionnement.component';
import { NewsComponent } from './static/news/news.component';
import { FrontPageComponent } from './static/front-page/front-page.component';
import { DocumentsComponent } from './static/documents/documents.component';
import { PageInConstructionComponent } from '../common/page-in-construction/page-in-construction.component';

export const routes: Routes = [
  { path: '',
     component: FrontComponent,
     children: [
      { path: 'authentification', component: ConnexionComponent},
      {path : 'tournaments', component: TournamentsComponent},
      { path: 'tournaments/:id', component: TournamentComponent },
      { path: 'purchases', component: PurchasesComponent },
      { path: 'tickets', component: GameCardsOwnedComponent },

      { path: 'école/fonctionnement', component: FonctionnementComponent },
      { path: 'école/inscription', component: PageInConstructionComponent },

      {path : 'news', component: NewsComponent },
      {path : 'documents', component: DocumentsComponent },

      { path: '', component: FrontPageComponent },
      { path: '**', component: PageNotFoundComponent },
     ]
   },
];