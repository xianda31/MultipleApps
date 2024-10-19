import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ProductService } from '../../../../../common/services/product.service';
import { Product } from '../../../../../admin-dashboard/src/app/sales/products/product.interface';

@Component({
  selector: 'app-keypad',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './keypad.component.html',
  styleUrl: './keypad.component.scss'
})
export class KeypadComponent implements OnInit, OnDestroy {
  @Input() keypad: Product[] = [];
  @Output() keyStroked = new EventEmitter<Product>();
  keys: { [key: string]: Product[] } = {};


  constructor(private productService: ProductService) { }

  ngOnDestroy(): void {
  }

  ngOnInit(): void {
    // sort products by category
    const categories: Map<string, Product[]> = new Map();
    this.keypad.forEach((product) => {
      if (categories.has(product.category)) {
        categories.get(product.category)!.push(product);
      } else {
        categories.set(product.category, [product]);
      }
    });
    this.keys = Object.fromEntries(categories);
    console.log(this.keys);
  }

  // get_products(key: string): Product[] {
  //   return categories.get(key) || [];
  // }

  onClick(product: Product) {
    this.keyStroked.emit(product);
  }
}
