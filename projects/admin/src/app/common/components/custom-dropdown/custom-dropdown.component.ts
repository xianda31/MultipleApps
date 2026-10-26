import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-custom-dropdown',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './custom-dropdown.component.html',
  styleUrl: './custom-dropdown.component.scss'
})
export class CustomDropdownComponent {
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  private suppressNextFocusSuggestions = false;

  @Input() items: any[] = [];
  @Input() placeholder = 'Rechercher...';
  @Input() searchValue = '';
  @Input() displayFn: (item: any) => string = (item) => item.toString();
  @Input() itemDisplayFn?: (item: any) => string;
  @Input() itemClassFn?: (item: any) => string;
  @Input() loading = false;
  @Input() invalid = false;
  @Input() invalidMessage = '';
  @Input() resultsHint = '';
  @Input() filterFn?: (item: any, searchValue: string) => boolean;

  @Output() itemSelected = new EventEmitter<any>();
  @Output() searchValueChange = new EventEmitter<string>();
  @Output() blurred = new EventEmitter<void>();

  showSuggestions = false;

  onInputChange(value: string) {
    this.searchValue = value;
    this.searchValueChange.emit(value);
    this.showSuggestions = true;
  }

  selectItem(item: any) {
    this.itemSelected.emit(item);
    this.showSuggestions = false;
  }

  onItemMouseDown(event: MouseEvent, item: any) {
    // Prevent input blur from closing the list before selection is applied.
    event.preventDefault();
    this.selectItem(item);
  }

  hideSuggestionsDelay() {
    this.blurred.emit();
    setTimeout(() => {
      this.showSuggestions = false;
    }, 200);
  }

  onFocus() {
    if (this.suppressNextFocusSuggestions) {
      this.suppressNextFocusSuggestions = false;
      return;
    }
    this.showSuggestions = true;
  }

  focus(): void {
    if (!this.searchInput) return;
    this.suppressNextFocusSuggestions = true;
    this.searchInput.nativeElement.focus();
  }

  getFilteredItems(): any[] {
    const items = this.items ?? [];
    if (!this.searchValue || this.searchValue.length === 0) {
      return items;
    }
    if (this.filterFn) {
      return items.filter(item => this.filterFn!(item, this.searchValue));
    }
    const searchLower = this.searchValue.toLowerCase();
    return items.filter(item =>
      (this.itemDisplayFn?.(item) ?? this.displayFn(item)).toLowerCase().includes(searchLower)
    );
  }
}
