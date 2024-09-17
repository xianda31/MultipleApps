import { Routes } from '@angular/router';
import { TournamentsComponent } from './tournaments/tournaments/tournaments.component';
import { HomePageComponent } from './pages/home-page/home-page.component';
import { PersonalDataComponent } from './personal/personal-data/personal-data.component';
import { TournamentComponent } from './tournaments/tournament/tournament.component';
import { loggedInGuard } from './guards/logged-in.guard';



export const routes: Routes = [
    { path: 'home', component: HomePageComponent },
    {
        path: 'tournaments',
        loadChildren: () => import('./tournaments/tournaments/tournaments.module').then(m => m.TournamentsModule),
        canActivate: [loggedInGuard]
    },
    {
        path: 'authentification',
        loadChildren: () => import('../../../common/authentification/authentification.module').then(m => m.AuthentificationModule),
    },
    { path: 'personal/data', component: PersonalDataComponent },
    { path: '', redirectTo: 'home', pathMatch: 'full' },
    { path: '**', redirectTo: 'home' }
];

