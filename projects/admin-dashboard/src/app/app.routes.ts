
import { Routes } from '@angular/router';
import { AuthComponent } from './auth/auth.component';
import { AdminsComponent } from './admins/admins.component';
import { LicenseesComponent } from './licensees/licensees.component';
import { TournamentsComponent } from './tournaments/tournaments/tournaments.component';

export const routes: Routes = [
    { path: 'auth', component: AuthComponent },
    { path: 'admins', component: AdminsComponent },
    { path: 'licensees', component: LicenseesComponent },
    { path: 'tournaments', component: TournamentsComponent },
    // { path: 'home', component: AppComponent },
    // { path: '**', redirectTo: '/' }
];
