import { Routes } from '@angular/router';
import { FrontComponent } from './front/front.component';
import { PageNotFoundComponent } from '../common/page-not-found/page-not-found.component';
import { SignInComponent } from '../common/authentification/sign-in/sign-in.component';
import { FrontPageComponent } from './front-page/front-page.component';
import { TournamentComponent } from '../common/tournaments/tournament/tournament.component';
import { PurchasesComponent } from './purchases/purchases.component';
import { GameCardsOwnedComponent } from './game-cards-owned/game-cards-owned.component';
import { TournamentsComponent } from '../common/tournaments/tournaments/tournaments.component';
import { FonctionnementComponent } from './static/fonctionnement/fonctionnement.component';
import { EnseignantsComponent } from './static/enseignants/enseignants.component';
import { NewsComponent } from './static/news/news.component';

export const routes: Routes = [
  { path: '',
     component: FrontComponent,
     children: [
      { path: 'authentification', component: SignInComponent },
      {path : 'tournaments', component: TournamentsComponent},
      { path: 'tournaments/:id', component: TournamentComponent },
      { path: 'purchases', component: PurchasesComponent },
      { path: 'tickets', component: GameCardsOwnedComponent },

      { path: 'fonctionnement', component: FonctionnementComponent },
      { path: 'enseignants', component: EnseignantsComponent },

      {path : 'news', component: NewsComponent },
      
      { path: '', component: FrontPageComponent },
      { path: '**', component: PageNotFoundComponent },
     ]
   },
];