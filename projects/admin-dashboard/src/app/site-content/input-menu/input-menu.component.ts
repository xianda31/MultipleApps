import { Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { Menu } from '../../../../../common/menu.interface';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-input-menu',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputMenuComponent),
      multi: true
    }
  ],
  imports: [CommonModule, FormsModule],
  templateUrl: './input-menu.component.html',
  styleUrl: './input-menu.component.scss'
})
export class InputMenuComponent implements ControlValueAccessor {
  @Input() menus: Menu[] = [];
  input!: Menu | null;

  onChange: (value: Menu | null) => void = () => { };
  onTouch: () => void = () => { };
  disabled = false;

  // constructor(  ) { }

  writeValue(input: any): void {
    if (input === undefined || input === null) {
      return;
    }
    // console.log('writeValue', JSON.stringify(input));

    let menu = this.menus.find((m) => m.id === input.id);
    this.input = menu ? menu : null;
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

  setValue(menu: Menu) {
    this.onTouch();
    this.onChange(menu);
  }

  onSelect(event: any) {
    this.onChange(this.input);
  }


}
