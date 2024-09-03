import { Component, input, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { club_tournament } from '../../../../../common/ffb/interface/club_tournament.interface';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputPlayerComponent } from '../../../../../common/ffb/input-player/input-player.component';
import { CommonModule } from '@angular/common';
import { Player } from '../../../../../common/ffb/interface/teams.interface';

@Component({
  selector: 'app-team-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, InputPlayerComponent],
  templateUrl: './team-registration.component.html',
  styleUrl: './team-registration.component.scss'
})
export class TeamRegistrationComponent implements OnInit {
  @Input() isolated_player!: Player;
  @Input() tournament !: club_tournament

  newTeamGroup: FormGroup = new FormGroup({
    player1: new FormControl<string>('', Validators.required),
    player2: new FormControl<string>('', Validators.required)
  });

  get player1() { return this.newTeamGroup.get('player1'); }
  get player2() { return this.newTeamGroup.get('player2'); }

  constructor(
    private activeModal: NgbActiveModal
  ) {
    console.log('isolated_player', this.isolated_player);
  }
  ngOnInit(): void {

    console.log('isolated_player', this.isolated_player);
    if (this.isolated_player) {
      // let player1 = this.isolated_player.person.lastname + ' ' + this.isolated_player.person.firstname + ' (' + this.isolated_player.person.license_number + ')';
      let player1 = this.isolated_player.person.license_number.toString();

      this.newTeamGroup.patchValue({ player1: player1 });
    }
  }

  cancel() {
    this.activeModal.close(null);
  }
  confirm() {
    this.activeModal.close(this.newTeamGroup.value);
  }
}
