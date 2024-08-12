import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FfbService } from '../../../../../common/ffb/services/ffb.service';
import { Person } from '../../../../../common/ffb/interface/teams.interface';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-inscription',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './inscription.component.html',
  styleUrl: './inscription.component.scss'
})
export class InscriptionComponent implements OnInit {

  @Input() tournamentTeamsId!: number;
  @Output() inscriptionDone = new EventEmitter<Person[] | null>();

  newTeam: FormGroup = new FormGroup({
    me: new FormControl('moi'),
    partner: new FormControl('mon partenaire')
  });



  teams!: Person[][];

  constructor(
    // private ffbService: FfbService
  ) { }

  ngOnInit(): void {

  }

  cancel() {
    console.log('InscriptionComponent.cancel');
    this.inscriptionDone.emit(null);
  }
  addTeam() {
    // this.teams.push([this.newTeam.value.me, this.newTeam.value.partner]);
    this.inscriptionDone.emit(null);
  }

}
