import { Component, Input, OnInit } from '@angular/core';
import { CommonModule, UpperCasePipe } from '@angular/common';
import { Person } from '../../../../../common/ffb/interface/tournament.ffb.interface';
import { FfbService } from '../../../../../common/ffb/services/ffb.service';
@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [UpperCasePipe, CommonModule],
  templateUrl: './teams.component.html',
  styleUrl: './teams.component.scss'
})
export class TeamsComponent implements OnInit {

  @Input() tournamentTeamsId!: number;


  teams !: Person[][];
  constructor(
    private ffbService: FfbService
  ) { }

  ngOnInit(): void {
    this.ffbService.getTournamentTeams(this.tournamentTeamsId).then((data) => {
      this.teams = data;
    });
  }



}
