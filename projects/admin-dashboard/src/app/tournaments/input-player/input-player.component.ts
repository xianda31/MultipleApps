import { Component, Input, OnInit } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FFBplayer } from '../../../../../common/ffb/interface/FFBplayer.interface';
import { FfbService } from '../../../../../common/ffb/services/ffb.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-input-player',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, CommonModule],
  templateUrl: './input-player.component.html',
  styleUrl: './input-player.component.scss'
})
export class InputPlayerComponent implements OnInit {

  @Input() control !: FormControl;

  partners!: FFBplayer[];


  constructor(
    private ffbService: FfbService
  ) { }

  ngOnInit(): void {
    this.control.valueChanges.subscribe((value) => {
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
