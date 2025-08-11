import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'rmbrackets'
})
export class RmbracketsPipe implements PipeTransform {

  transform(value: string): string {
    if (!value) return '';
    // Remplace toutes les sous-chaînes entre < et > par un espace
    return value.replace(/<[^>]*>/g, ' ');
  }

}
