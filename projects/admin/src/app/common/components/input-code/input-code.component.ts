import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, QueryList, ViewChildren, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-input-code',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './input-code.component.html',
  styleUrl: './input-code.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputCodeComponent),
      multi: true,
    },
  ],
})
export class InputCodeComponent implements ControlValueAccessor {
  @Input() length = 6;
  @Input() digitsOnly = true;
  @Input() ariaLabel = 'Code de verification';

  @ViewChildren('proxyInput') proxyInputs?: QueryList<ElementRef<HTMLInputElement>>;

  value = '';
  activeIndex = 0;
  disabled = false;

  onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  get chars(): string[] {
    return Array.from({ length: this.length }, (_, index) => this.value[index] ?? '');
  }

  writeValue(value: string | null): void {
    this.value = this.normalize(value ?? '');
    this.activeIndex = Math.min(this.value.length, this.length - 1);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  focus(index = 0): void {
    if (this.disabled) {
      return;
    }

    this.activeIndex = this.clamp(index);
    const input = (this.proxyInputs?.toArray() ?? [])[0]?.nativeElement;
    if (!input) {
      return;
    }

    input.focus();
    const caret = this.clamp(this.activeIndex, this.length);
    try {
      input.setSelectionRange(caret, caret);
    } catch {
      // noop
    }
  }

  onShellClick(index: number): void {
    this.focus(index);
  }

  onProxyFocus(): void {
    this.activeIndex = Math.min(this.value.length, this.length - 1);
  }

  onProxyBlur(): void {
    this.onTouched();
  }

  onProxyInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const normalized = this.normalize(input.value);
    this.value = normalized;
    this.onChange(this.value);

    this.activeIndex = Math.min(this.value.length, this.length - 1);
    this.focus(this.activeIndex);
  }

  onProxyKeydown(event: KeyboardEvent): void {
    if (event.key === 'Tab') {
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.focus(this.activeIndex - 1);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.focus(this.activeIndex + 1);
      return;
    }

    if (event.key === 'Backspace') {
      this.activeIndex = Math.max(0, this.value.length - 1);
      return;
    }

    if (event.key === 'Delete') {
      this.activeIndex = Math.min(this.length - 1, this.value.length);
      return;
    }

    if (this.isAllowedChar(event.key)) {
      this.activeIndex = Math.min(this.length - 1, this.value.length);
      return;
    }

    event.preventDefault();
  }

  private isAllowedChar(key: string): boolean {
    if (key.length !== 1) {
      return false;
    }

    if (this.digitsOnly) {
      return /^\d$/.test(key);
    }

    return /^[a-zA-Z0-9]$/.test(key);
  }

  private normalize(value: string): string {
    if (this.digitsOnly) {
      return value.replace(/\D/g, '').slice(0, this.length);
    }

    return value.replace(/[^a-zA-Z0-9]/g, '').slice(0, this.length);
  }

  private clamp(value: number, max = this.length - 1): number {
    return Math.max(0, Math.min(max, value));
  }
}
