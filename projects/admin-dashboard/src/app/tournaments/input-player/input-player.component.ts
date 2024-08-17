import { Component, forwardRef, Input, OnInit } from '@angular/core';
import { ControlValueAccessor, FormControl, FormsModule, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { FFBplayer } from '../../../../../common/ffb/interface/FFBplayer.interface';
import { FfbService } from '../../../../../common/ffb/services/ffb.service';
import { CommonModule } from '@angular/common';
import { get } from 'aws-amplify/api';
import { debounceTime } from 'rxjs';

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
  search: string = '';
  // selectedOption: FFBplayer | null = null;
  partners!: FFBplayer[];

  onChange: (value: string) => void = () => { };
  onTouch: () => void = () => { };
  disabled = false;

  constructor(
    private ffbService: FfbService
  ) { }

  writeValue(input: any): void {
    console.log('writeValue', input);
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

  clicked() {
    console.log('clicked');
    // this.onChange(value);
  }

  ngOnInit(): void {

    // let listeFFB = document.getElementById('listeFFB');
    // listeFFB?.addEventListener('click', (event) => {
    //   let target = event.target as HTMLElement;
    //   if (target.tagName === 'LI') {
    //     let value = target.getAttribute('data-value');
    //     console.log('click', value);
    //     // this.input.setValue(value);
    //     // this.onChange(value);
    //   }
    // });

    this.input.valueChanges
      .pipe(
        debounceTime(400),
      )
      .subscribe((value) => {
        if (value) {
          let search = value;
          console.log('valueChanges : ', search);
          this.onChange('#' + search);
          if (search.length > 3) {
            this.ffbService.searchPlayersSuchAs(search)
              .then((partners: FFBplayer[]) => {
                this.partners = partners;
              });
          }
        }
      });
    // this.control.valueChanges.subscribe((value) => {
    //   if (value) {
    //     let search = value;
    //     console.log('valueChanges : ', search);
    //     if (search.length > 3) {
    //       this.ffbService.searchPlayersSuchAs(search)
    //         .then((partners: FFBplayer[]) => {
    //           this.partners = partners;
    //         });
    //     }
    //   }
    // }    );
  }
  ngOnDestroy() {
    // this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}
