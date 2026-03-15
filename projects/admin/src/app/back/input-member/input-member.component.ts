import { CommonModule } from '@angular/common';
import { Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { Member } from '../../common/interfaces/member.interface';
import { CustomDropdownComponent } from '../../common/components/custom-dropdown/custom-dropdown.component';

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
    imports: [ReactiveFormsModule, FormsModule, CommonModule, CustomDropdownComponent],
    templateUrl: './input-member.component.html',
    styleUrl: './input-member.component.scss'
})
export class InputMemberComponent implements ControlValueAccessor {
  @Input() members: Member[] = [];
  input!: string;
  searchInput: string = '';

  onChange: (value: Member | null) => void = () => {
  };
  onTouch: () => void = () => { };
  disabled = false;

  displayMemberFn = (member: Member) => `${member.lastname.toUpperCase()} ${member.firstname}`;

  writeValue(input: Member | null): void {
    if (input === undefined || input === null) {
      this.input = '';
      this.searchInput = '';
      return;
    }
    this.input = input.lastname + '\u00A0' + input.firstname;
    this.searchInput = this.displayMemberFn(input);
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
    this.searchInput = value;
  }

  onMemberSelected(member: Member) {
    this.input = member.lastname + '\u00A0' + member.firstname;
    this.searchInput = this.displayMemberFn(member);
    this.onChange(member);
  }
}


