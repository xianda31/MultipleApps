import { Pipe, PipeTransform } from '@angular/core';
import { BreakingNewsMessage } from './breaking-news.service';

@Pipe({
  name: 'filterByActive',
  standalone: true
})
export class FilterByActivePipe implements PipeTransform {
  transform(messages: BreakingNewsMessage[]): BreakingNewsMessage[] {
    return messages.filter(msg => msg.active);
  }
}
