import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: '3digits',
  standalone: true
})
export class threedigitsPipe implements PipeTransform {

  transform(nbr: number): string {
    let disp = new Intl.NumberFormat('fr-FR').format(nbr)
    return disp;

  }

}
