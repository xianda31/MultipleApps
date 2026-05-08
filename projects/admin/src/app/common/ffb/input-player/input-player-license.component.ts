import { Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { FFBplayer } from '../interface/FFBplayer.interface';
import { FFB_proxyService } from '../services/ffb.service';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-input-player-license',
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => InputPlayerLicenseComponent),
            multi: true
        }
    ],
    imports: [ReactiveFormsModule, FormsModule, CommonModule],
    templateUrl: './input-player-license.component.html',
    styleUrl: './input-player-license.component.scss'
})
export class InputPlayerLicenseComponent implements ControlValueAccessor {
  @Input() listeId!: string;
  @Input() placeholder!: string;

  str_player: string = '';
  partners!: FFBplayer[];
  showSuggestions: boolean = false;
  private hideSuggestionsTimeout: any;
  private selectedLicense: string | null = null;
  private hasBlurred = false;

  onChange: (value: string) => void = () => { };
  onTouch: () => void = () => { };
  disabled = false;

  constructor(
    private ffbService: FFB_proxyService
  ) { }

  writeValue(input: any): void {
    if (input === undefined || input === null) {
      this.str_player = '';
      this.selectedLicense = null;
      return;
    }
    this.str_player = input;
    this.selectedLicense = null;
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
    return this.hasBlurred && this.str_player.trim().length > 0 && !this.selectedLicense;
  }

  setValue(str_player: string) {
    this.onTouch();

    // Toute saisie manuelle invalide la licence tant qu'aucun partenaire n'est sélectionné.
    this.selectedLicense = null;
    this.onChange('');

    if (str_player.length > 3) {
      this.ffbService.searchPlayersSuchAs(str_player)
        .then((partners: FFBplayer[]) => {
          this.partners = partners;
          this.showSuggestions = true;
        });
    } else {
      this.showSuggestions = false;
    }
  }

  selectPartner(partner: FFBplayer) {
    this.str_player = `${partner.lastname} ${partner.firstname} (${partner.license_number})`;
    this.selectedLicense = partner.license_number?.toString() || '';
    this.hasBlurred = false;
    this.onChange(this.selectedLicense);
    this.showSuggestions = false;
  }

  hideSuggestionsDelay() {
    this.hasBlurred = true;
    // Délai pour permettre au click sur une option de se déclencher
    this.hideSuggestionsTimeout = setTimeout(() => {
      this.showSuggestions = false;
    }, 200);
  }

}

