import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'phone',
  standalone: true
})
export class PhonePipe implements PipeTransform {

  transform(str: string): string {
    if (!str) {
      return '';
    }
    if (str.startsWith('33')) {
      str = str.replace('33', '0');
    }
    str = str.replace(/\+\d\d|\d\d?(?=(?:\d\d)+\b)/g, '$& ');
    str = str.replace(/ /g, '\u00a0');
    return str;

  }

}
