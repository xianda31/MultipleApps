import { Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { ClubMember } from '../interface/club-member.interface';
import { FFB_proxyService } from '../services/ffb.service';
import { CommonModule } from '@angular/common';
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
  players: ClubMember[] = [];
  private selectedPlayer: ClubMember | null = null;
  private hasBlurred = false;

  onChange: (value: ClubMember | null) => void = () => { };
  onTouch: () => void = () => { };
  disabled = false;

  displayPlayerFn = (player: ClubMember) => `${player.lastName} ${player.firstName} (${player.license_number})`;

  constructor(
    private ffbService: FFB_proxyService
  ) { }

  writeValue(input: any): void {
    if (input) {
      if (typeof input === 'string') {
        this.str_player = input;
        this.selectedPlayer = null;
      } else if (input && typeof input === 'object') {
        const player = input as ClubMember;
        this.selectedPlayer = player;
        this.str_player = this.displayPlayerFn(player);
      }
    } else {
      this.str_player = '';
      this.selectedPlayer = null;
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

  get showInvalidSelection(): boolean {
    return this.hasBlurred && this.str_player.trim().length > 0 && !this.selectedPlayer;
  }

  onSearchChange(value: string) {
    this.onTouch();
    this.str_player = value;

    // Toute saisie manuelle invalide la sélection tant que l'utilisateur n'a pas recliqué une suggestion.
    if (!this.selectedPlayer || value !== this.displayPlayerFn(this.selectedPlayer)) {
      this.selectedPlayer = null;
      this.onChange(null);
    }

    if (value.length > 3) {
      this.ffbService.searchPlayersSuchAs(value)
        .then((players) => {
          this.players = players;
        });
    } else {
      // console.log(value,' : Input too short for search');
    }
  }

  onPlayerSelected(player: ClubMember) {
    this.selectedPlayer = player;
    this.hasBlurred = false;
    this.str_player = `${player.lastName} ${player.firstName} (${player.license_number})`;
    this.onChange(player);
  }

  onInputBlur() {
    this.hasBlurred = true;
  }
}

