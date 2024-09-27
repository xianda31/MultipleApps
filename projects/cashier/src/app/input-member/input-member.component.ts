import { CommonModule } from '@angular/common';
import { Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { Member } from '../../../../common/members/member.interface';

@Component({
  selector: 'app-input-member',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputMemberComponent),
      multi: true
    }
  ],
  imports: [ReactiveFormsModule, FormsModule, CommonModule],
  templateUrl: './input-member.component.html',
  styleUrl: './input-member.component.scss'
})
export class InputMemberComponent implements ControlValueAccessor {
  @Input() members: Member[] = [];
  input!: string;

  onChange: (value: Member | null) => void = () => {
  };
  onTouch: () => void = () => { };
  disabled = false;

  // constructor(  ) { }

  writeValue(input: any): void {
    if (input === undefined || input === null || input === '') {
      this.input = '';
      return;
    }
    this.input = input;
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

  setValue(input: string) {
    this.onTouch();
    const license_number = input.split(': ')[1];
    const member = this.members.find((m) => m.license_number == license_number) ?? null;
    this.onChange(member);
  }

}
