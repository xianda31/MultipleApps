import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'moveToEnd'
})
/**
 * Pipe that moves the entry with a specified key to the end of a collection.
 *
 * Supports input as Map, array of key-value pairs, or plain objects.
 * Useful for custom ordering in Angular templates, such as displaying a specific item last.
 *
 * @param items - The collection to reorder. Can be a Map, array, or object.
 * @param keyToEnd - The key of the entry to move to the end of the collection.
 * @returns A new array with the specified entry moved to the end.
 */
export class MoveToEndPipe

implements PipeTransform {



  transform(items: any, keyToEnd: string): any[] {
    if (!items) return [];
    let arr: any[] = [];
    // If items is a Map
    if (items instanceof Map) {
      arr = Array.from(items.entries()).map(([key, value]) => ({ key, value }));
    } else if (Array.isArray(items)) {
      // Detect if array is [{key, value}] (Angular keyvalue pipe) or [key, value] tuples
      if (items.length && typeof items[0] === 'object' && 'key' in items[0] && 'value' in items[0]) {
        arr = items;
      } else if (items.length && Array.isArray(items[0]) && items[0].length === 2) {
        arr = items.map(([key, value]) => ({ key, value }));
      } else {
        arr = items;
      }
    } else if (typeof items === 'object') {
      arr = Object.entries(items).map(([key, value]) => ({ key, value }));
    }
    // Move the entry with keyToEnd to the end
    const others = arr.filter(entry => entry.key !== keyToEnd);
    const end = arr.filter(entry => entry.key === keyToEnd);
    return [...others, ...end];
  }
}
