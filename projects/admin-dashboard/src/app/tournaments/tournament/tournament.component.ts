import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FfbService } from '../../../../../common/ffb/services/ffb.service';
import { TournamentTeams } from '../../../../../common/ffb/interface/tournament_teams.interface';

@Component({
  selector: 'app-tournament',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tournament.component.html',
  styleUrl: './tournament.component.scss'
})

export class TournamentComponent implements OnChanges {
  @Input() tournamentId: number = 0;

  tournament !: TournamentTeams;
  constructor(
    private ffbService: FfbService
  ) { }

  ngOnChanges(changes: SimpleChanges): void {
    console.log('TournamentComponent.ngOnChanges', changes);
    this.ffbService.getTournamentTeams(this.tournamentId).then((data) => {
      this.tournament = data;
      console.log('TournamentComponent.getTournamentTeams', data);
    });
  }

}
