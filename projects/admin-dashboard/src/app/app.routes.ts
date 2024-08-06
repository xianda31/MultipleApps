
import { Component } from '@angular/core';
import { Routes } from '@angular/router';
import { AuthComponent } from './auth/auth/auth.component';
import { AppComponent } from './app.component';
import { AdminsComponent } from './admin/admins/admins.component';
import { MembersComponent } from './members/members.component';
import { TournamentsComponent } from './tournaments/tournaments/tournaments.component';

export const routes: Routes = [
    { path: 'auth', component: AuthComponent },
    { path: 'admins', component: AdminsComponent },
    { path: 'members', component: MembersComponent },
    { path: 'tournaments', component: TournamentsComponent },
    // { path: 'home', component: AppComponent },
    // { path: '**', redirectTo: '/' }
];
