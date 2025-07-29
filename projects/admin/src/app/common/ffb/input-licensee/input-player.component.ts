import { Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { FFBplayer } from '../interface/FFBplayer.interface';
import { FFB_proxyService } from '../services/ffb.service';
import { CommonModule } from '@angular/common';
import { FFB_licensee } from '../interface/licensee.interface';
import { Player } from '../interface/tournament_teams.interface';

@Component({
    selector: 'app-input-player',
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => InputPlayerComponent),
            multi: true
        }
    ],
    imports: [ReactiveFormsModule, FormsModule, CommonModule],
    templateUrl: './input-player.component.html',
    styleUrl: './input-player.component.scss'
})
export class InputPlayerComponent implements ControlValueAccessor {
  @Input() listeId!: string;
  @Input() placeholder!: string;

  str_player: string = '';
  players: FFBplayer[] = [];

  onChange: (value: FFBplayer) => void = () => { };
  onTouch: () => void = () => { };
  disabled = false;

  constructor(
    private ffbService: FFB_proxyService
  ) { }

  writeValue(input: any): void {
    // if (input === undefined || input === null) {
    //   return;
    // }
    // this.input.setValue('#' + input);
    this.str_player = input;
    // console.log('writeValue', input);
  }
  registerOnChange(fn: any): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: any): void {
    this.onTouch = fn;
  }
  setDisabledState?(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  setValue(str_player: string) {
    this.onTouch();
    if (str_player.length > 3) {
      this.ffbService.searchPlayersSuchAs(str_player)
        .then((players) => {
          this.players = players;
          // console.log('%s options found', licensees.length);
        });
      this.onChange((this.search(str_player)));
    }
  }

  search(str: string): FFBplayer {
    const license = this.getLicenceNbr(str);
    const player = this.players.find((player) => player.license_number === license);
    // console.log('%s => %s', str, player);
    return player!;
  }
  getLicenceNbr(str: string): string {
    return str.substring(0, str.length - 1).split('(')[1] ?? '';
  }

}

