import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'capitalize_first',
  standalone: true
})
export class CapitalizeFirstPipe implements PipeTransform {

  transform(str: string): string {
    str = str.replace(/^(\w)(.+)/, (match, p1, p2) => p1.toUpperCase() + p2.toLowerCase())
    return str;

  }

}
