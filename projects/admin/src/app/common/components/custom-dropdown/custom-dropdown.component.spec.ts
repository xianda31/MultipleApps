import { ElementRef } from '@angular/core';
import { CustomDropdownComponent } from './custom-dropdown.component';

describe('CustomDropdownComponent', () => {
  it('returns no result while items are still loading', () => {
    const component = new CustomDropdownComponent();
    component.items = undefined as unknown as unknown[];

    expect(component.getFilteredItems()).toEqual([]);
  });

  it('focuses the input without opening every suggestion automatically', () => {
    const component = new CustomDropdownComponent();
    const input = document.createElement('input');
    const focus = spyOn(input, 'focus');
    component.searchInput = new ElementRef(input);

    component.focus();
    component.onFocus();

    expect(focus).toHaveBeenCalled();
    expect(component.showSuggestions).toBeFalse();
  });
});
