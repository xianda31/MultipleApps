import { Pipe, PipeTransform } from '@angular/core';

export function normalizeFrenchPhoneNumber(value: string): string {
  const original = value?.trim() ?? '';
  if (!original) {
    return '';
  }

  const compact = original.replace(/[ .-]/g, '');
  let domestic = compact;
  if (/^\+33[1-9]\d{8}$/.test(compact)) {
    domestic = `0${compact.slice(3)}`;
  } else if (/^0033[1-9]\d{8}$/.test(compact)) {
    domestic = `0${compact.slice(4)}`;
  } else if (/^33[1-9]\d{8}$/.test(compact)) {
    domestic = `0${compact.slice(2)}`;
  }

  return /^0[1-9]\d{8}$/.test(domestic)
    ? domestic.match(/\d{2}/g)!.join(' ')
    : original;
}

export function formatPhoneNumber(str: string): string {
  return normalizeFrenchPhoneNumber(str).replace(/ /g, '\u00a0');
}

@Pipe({
  name: 'phone',
  standalone: true
})
export class PhonePipe implements PipeTransform {

  transform(str: string): string {
    return formatPhoneNumber(str);
  }
}
