import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'trail',
    standalone: true
})
export class TrailPipe implements PipeTransform {

    transform(string: string): string {
        let count = string.indexOf('|');
        if (count === -1) { return ""; }
        return string.slice(count + 1, string.length);
    }

}
