import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'truncate',
  standalone: true
})
export class TruncatePipe implements PipeTransform {

  transform(value: string, length: number): string {
    let truncatedValue = value.slice(0, length);
    if (value.length > length) {
      truncatedValue += '...';
    } 
    return truncatedValue;
  }

}
