import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FfbService } from '../../../../../common/ffb/services/ffb.service';
import { Person } from '../../../../../common/ffb/interface/teams.interface';
import { Form, FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FFBplayer } from '../../../../../common/ffb/interface/FFBplayer.interface';
import { CommonModule } from '@angular/common';
import { Observable, debounceTime, distinctUntilChanged, from } from 'rxjs';
import { InputPlayerComponent } from "../input-player/input-player.component";

@Component({
  selector: 'app-inscription',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, CommonModule, InputPlayerComponent],
  templateUrl: './inscription.component.html',
  styleUrl: './inscription.component.scss'
})
export class InscriptionComponent {

  @Input() tournamentTeamsId!: number;
  @Output() inscriptionDone = new EventEmitter<Person[] | null>();


  // partners!: FFBplayer[];


  // newTeam: FormGroup = new FormGroup({
  // partner: FormControl<FFBplayer | null> = new FormControl<FFBplayer | null>(null)
  // });

  partner: FormControl = new FormControl();

  constructor(
    private ffbService: FfbService
  ) {

    this.partner.valueChanges.subscribe((license_number) => {
      if (license_number) {
        console.log('InscriptionComponent.partner.valueChanges', license_number);
      }
    });
  }

  go() {
    this.ffbService.postTeam('148080').then((data) => {
      console.log('inscription done', JSON.stringify(data));
    });

  }

}
