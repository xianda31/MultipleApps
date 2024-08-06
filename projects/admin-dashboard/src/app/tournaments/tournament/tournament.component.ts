import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { FfbService } from '../../ffb/services/ffb.service';
import { Person } from '../../ffb/interface/tournament.ffb.interface';
import { CommonModule } from '@angular/common';

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
