import { Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { FFBplayer } from '../interface/FFBplayer.interface';
import { FFB_proxyService } from '../services/ffb.service';
import { CommonModule } from '@angular/common';
import { FFB_licensee } from '../interface/licensee.interface';
import { Player } from '../interface/tournament_teams.interface';
import { CustomDropdownComponent } from '../../components/custom-dropdown/custom-dropdown.component';

@Component({
    selector: 'app-input-player',
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => InputPlayerComponent),
            multi: true
        }
    ],
    imports: [ReactiveFormsModule, FormsModule, CommonModule, CustomDropdownComponent],
    templateUrl: './input-player.component.html',
    styleUrl: './input-player.component.scss'
})
export class InputPlayerComponent implements ControlValueAccessor {
  @Input() placeholder!: string;

  str_player: string = '';
  players: FFBplayer[] = [];

  onChange: (value: FFBplayer) => void = () => { };
  onTouch: () => void = () => { };
  disabled = false;

  displayPlayerFn = (player: FFBplayer) => `${player.firstname} ${player.lastname} (${player.license_number})`;

  constructor(
    private ffbService: FFB_proxyService
  ) { }

  writeValue(input: any): void {
    if (input) {
      if (typeof input === 'string') {
        this.str_player = input;
      } else if (input && typeof input === 'object') {
        this.str_player = this.displayPlayerFn(input);
      }
    } else {
      this.str_player = '';
    }
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

  onSearchChange(value: string) {
    this.onTouch();
    this.str_player = value;
    if (value.length > 3) {
      this.ffbService.searchPlayersSuchAs(value)
        .then((players) => {
          this.players = players;
        });
      const selectedPlayer = this.search(value);
      if (selectedPlayer) {
        this.onChange(selectedPlayer);
      }
    }
  }

  onPlayerSelected(player: FFBplayer) {
    this.str_player = `${player.firstname} ${player.lastname} (${player.license_number})`;
    this.onChange(player);
  }

  private search(str: string): FFBplayer | undefined {
    const license = this.getLicenceNbr(str);
    return this.players.find((player) => player.license_number === license);
  }

  private getLicenceNbr(str: string): string {
    return str.substring(0, str.length - 1).split('(')[1] ?? '';
  }
}

