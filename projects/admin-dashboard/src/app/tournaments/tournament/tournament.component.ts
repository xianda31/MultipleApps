import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Person } from '../../../../../common/ffb/interface/tournament.ffb.interface';
import { FfbService } from '../../../../../common/ffb/services/ffb.service';

@Component({
  selector: 'app-tournament',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tournament.component.html',
  styleUrl: './tournament.component.scss'
})

export class TournamentComponent implements OnChanges {
  @Input() tournamentId: number = 0;

  teams !: Person[][];
  constructor(
    private ffbService: FfbService
  ) { }

  ngOnChanges(changes: SimpleChanges): void {
    console.log('TournamentComponent.ngOnChanges', changes);
    this.ffbService.getTournamentTeams(this.tournamentId).then((data) => {
      this.teams = data;
      console.log('TournamentComponent.getTournamentTeams', data);
    });
  }

}
