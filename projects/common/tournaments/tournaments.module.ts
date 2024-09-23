import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TournamentsComponent } from './tournaments/tournaments.component';
import { TournamentComponent } from './tournament/tournament.component';
import { RouterModule, Routes } from '@angular/router';
import { WrapperComponent } from './wrapper/wrapper.component';
import { FfbService } from '../ffb/services/ffb.service';

const routes: Routes = [
  {
    path: '',
    component: TournamentsComponent,
    children: [
      { path: ':id', component: TournamentComponent },
      { path: 'log', component: TournamentComponent }
    ]
  }
]

@NgModule({
  imports: [
    CommonModule,
    TournamentsComponent,
    TournamentComponent,
    RouterModule.forChild(routes)
  ],
  exports: [
    TournamentsComponent
  ],
  providers: []
})

export class TournamentsModule { }
