
import { Routes } from '@angular/router';
import { AuthComponent } from './auth/auth.component';
import { AdminsComponent } from './admins/admins.component';
import { LicenseesComponent } from './licensees/licensees.component';
import { TournamentsComponent } from './tournaments/tournaments/tournaments.component';
import { MembersComponent } from './members/members.component';
import { HomePageComponent } from './home-page/home-page.component';

export const routes: Routes = [
    { path: 'tournaments', component: TournamentsComponent },
    { path: 'auth', component: AuthComponent },
    { path: 'admins', component: AdminsComponent },
    { path: 'licensees', component: LicenseesComponent },
    { path: 'members', component: MembersComponent },
    { path: 'home', component: HomePageComponent },
    { path: '', redirectTo: '/home', pathMatch: 'full' }

];
