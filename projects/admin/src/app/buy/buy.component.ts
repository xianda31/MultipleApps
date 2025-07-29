import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { BooksEditorComponent } from '../books/books-edit/books-editor.component';

@Component({
    selector: 'app-buy',
    imports: [CommonModule,  BooksEditorComponent],
    templateUrl: './buy.component.html',
    styleUrl: './buy.component.scss'
})
export class BuyComponent  {
  constructor(
    private location: Location
  ) { }



  cancel() {
    this.location.back();
  }
}
