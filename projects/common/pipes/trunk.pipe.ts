import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'trunk',
    standalone: true
})
export class TrunkPipe implements PipeTransform {

    transform(string: string): string {
        let count = string.indexOf('|');
        if (count === -1) return string;
        return string.slice(0, count);
    }

}
