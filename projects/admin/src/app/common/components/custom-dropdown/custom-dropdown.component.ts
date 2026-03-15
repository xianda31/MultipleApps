import { Component, EventEmitter, Input, Output } from '@angular/core';
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
  @Input() items: any[] = [];
  @Input() placeholder = 'Rechercher...';
  @Input() searchValue = '';
  @Input() displayFn: (item: any) => string = (item) => item.toString();

  @Output() itemSelected = new EventEmitter<any>();
  @Output() searchValueChange = new EventEmitter<string>();

  showSuggestions = false;

  onInputChange(value: string) {
    this.searchValue = value;
    this.searchValueChange.emit(value);
    this.showSuggestions = value.length > 0;
  }

  selectItem(item: any) {
    this.itemSelected.emit(item);
    this.showSuggestions = false;
  }

  hideSuggestionsDelay() {
    setTimeout(() => {
      this.showSuggestions = false;
    }, 200);
  }

  onFocus() {
    // Dropdown s'affiche seulement lors de la saisie (au moins 1 caractère)
  }

  getFilteredItems(): any[] {
    if (!this.searchValue || this.searchValue.length === 0) {
      return this.items;
    }
    const searchLower = this.searchValue.toLowerCase();
    return this.items.filter(item => 
      this.displayFn(item).toLowerCase().includes(searchLower)
    );
  }
}
