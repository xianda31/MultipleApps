import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'parenthesis',
  standalone: true
})
export class ParenthesisPipe implements PipeTransform {

  transform(string: string | null): string {
    if (string === null) { return ""; }
    if (string.startsWith('-')) {
      let value = string.slice(1, string.length);
      return '(' + value + ')';
    } else {
      return string;
    }
  }
}
