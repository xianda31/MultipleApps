import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TournamentsComponent } from './tournaments.component';
import { TournamentComponent } from '../tournament/tournament.component';
import { RouterModule, Routes } from '@angular/router';

const Routes: Routes = [
  {
    path: '',
    component: TournamentsComponent,
    children: [
      { path: ':id', component: TournamentComponent }]
  }
]

@NgModule({
  imports: [
    CommonModule,
    TournamentsComponent,
    TournamentComponent,
    RouterModule.forChild(Routes)
  ],
  exports: [
    TournamentsComponent
  ]
})

export class TournamentsModule { }
