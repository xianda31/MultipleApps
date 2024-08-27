import { Pipe, PipeTransform } from '@angular/core';

const MAX_LENGTH = 40;

@Pipe({
    name: 'trunk',
    standalone: true
})
export class TrunkPipe implements PipeTransform {

    transform(string: string): string {
        let count = string.indexOf('|');
        if (count === -1) {
            count = MAX_LENGTH;
            console.log('No trunk found => ', string.slice(0, count));
        }
        return string.slice(0, count);
    }

}
