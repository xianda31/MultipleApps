import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function localDateValue(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isFuturePublicationDate(value: unknown, today = localDateValue()): boolean {
  return typeof value === 'string' && value.substring(0, 10) > today;
}

export const noFuturePublicationDate: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  isFuturePublicationDate(control.value) ? { futurePublicationDate: true } : null;