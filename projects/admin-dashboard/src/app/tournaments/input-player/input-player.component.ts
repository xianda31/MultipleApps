import { Component, forwardRef, Input, OnInit } from '@angular/core';
import { ControlValueAccessor, FormControl, FormsModule, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { FFBplayer } from '../../../../../common/ffb/interface/FFBplayer.interface';
import { FfbService } from '../../../../../common/ffb/services/ffb.service';
import { CommonModule } from '@angular/common';
import { get } from 'aws-amplify/api';
import { debounceTime, from, Observable } from 'rxjs';

@Component({
  selector: 'app-input-player',
  standalone: true,
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
export class InputPlayerComponent implements OnInit, ControlValueAccessor {

  input: FormControl = new FormControl();
  partners!: FFBplayer[];

  onChange: (value: string) => void = () => { };
  onTouch: () => void = () => { };
  disabled = false;

  constructor(
    private ffbService: FfbService
  ) { }

  writeValue(input: any): void {
    if (input === undefined || input === null) {
      return;
    }
    this.input.setValue('#' + input);
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

  ngOnInit(): void {
    this.input.valueChanges.pipe(debounceTime(100))
      .subscribe((search) => {
        if (search) {
          if (search.length > 3) {
            this.ffbService.searchPlayersSuchAs(search)
              .then((partners: FFBplayer[]) => {
                this.partners = partners;
              });
          }
          this.onChange(this.getLicenceNbr(search));
        }
      });
  }

  getLicenceNbr(str: string): string {
    // let arr = str.substring(0, str.length - 1).split('(');
    // console.log('getLicenceNbr', arr);
    return str.substring(0, str.length - 1).split('(')[1] ?? '';
  }


}

