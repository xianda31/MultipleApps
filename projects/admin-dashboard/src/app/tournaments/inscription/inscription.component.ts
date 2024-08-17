import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FfbService } from '../../../../../common/ffb/services/ffb.service';
import { Person } from '../../../../../common/ffb/interface/teams.interface';
import { Form, FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FFBplayer } from '../../../../../common/ffb/interface/FFBplayer.interface';
import { CommonModule } from '@angular/common';
import { Observable, debounceTime, distinctUntilChanged, from } from 'rxjs';

@Component({
  selector: 'app-inscription',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, CommonModule],
  templateUrl: './inscription.component.html',
  styleUrl: './inscription.component.scss'
})
export class InscriptionComponent implements OnInit {

  @Input() tournamentTeamsId!: number;
  @Output() inscriptionDone = new EventEmitter<Person[] | null>();


  partners!: FFBplayer[];


  // newTeam: FormGroup = new FormGroup({
  // partner: FormControl<FFBplayer | null> = new FormControl<FFBplayer | null>(null)
  // });

  partner: FormControl = new FormControl();

  constructor(
    private ffbService: FfbService
  ) { }

  ngOnInit(): void {
    this.partner.valueChanges.pipe(
      // debounceTime(400),
      // distinctUntilChanged()
    )
      .subscribe((value) => {
        if (value) {
          let search = value;
          console.log('valueChanges : ', search);
          if (search.length > 3) {
            this.ffbService.searchPlayersSuchAs(search)
              .then((partners: FFBplayer[]) => {
                this.partners = partners;
              });
          }
        }
      }
      );
  }
}
