import { Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { FFBplayer } from '../interface/FFBplayer.interface';
import { FFB_proxyService } from '../services/ffb.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-input-player-license',
  standalone: true,
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

  onChange: (value: string) => void = () => { };
  onTouch: () => void = () => { };
  disabled = false;

  constructor(
    private ffbService: FFB_proxyService
  ) { }

  writeValue(input: any): void {
    if (input === undefined || input === null) {
      return;
    }
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
        .then((partners: FFBplayer[]) => {
          this.partners = partners;
          // console.log('%s options found', partners.length);
        });
      this.onChange(this.getLicenceNbr(str_player));
    }
  }

  getLicenceNbr(str: string): string {
    return str.substring(0, str.length - 1).split('(')[1] ?? '';
  }


}

