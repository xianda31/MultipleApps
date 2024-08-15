import { Component, Input, OnInit } from '@angular/core';
import { CommonModule, UpperCasePipe } from '@angular/common';
import { Person } from '../../../../../common/ffb/interface/teams.interface';
import { FfbService } from '../../../../../common/ffb/services/ffb.service';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MembersService } from '../../members/service/members.service';
@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [UpperCasePipe, CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './teams.component.html',
  styleUrl: './teams.component.scss'
})
export class TeamsComponent implements OnInit {

  @Input() tournamentTeamsId!: number;
  // toggler: boolean = false;

  newTeam: FormGroup = new FormGroup({
    me: new FormControl('moi'),
    partner: new FormControl('mon partenaire')
  });



  teams !: Person[][];
  constructor(
    private ffbService: FfbService,
    private MembersService: MembersService
  ) { }

  ngOnInit(): void {
    this.ffbService.getTournamentTeams(this.tournamentTeamsId).then((data) => {
      this.teams = data;
    });
  }

  addTeam() {
    console.log('TeamsComponent.addTeam', this.newTeam.value);
  }

  deleteTeam(team: Person[]) {
    console.log('TeamsComponent.deleteTeam', team);
    this.teams = this.teams.filter((t) => t !== team);
  }

  membership(license_number: number): boolean {
    let license: string = license_number.toString().padStart(8, '0');
    return this.MembersService.isMember(license);
  }

}
