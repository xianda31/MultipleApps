import { Component, EventEmitter, Input, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductService } from '../../../../../common/services/product.service';
import { Product } from '../../../../../admin-dashboard/src/app/sales/products/product.interface';
import { Payment_key, PAYMENT_KEYS } from './keypad.interface';
import { PaymentMode } from '../../../../../common/new_sales.interface';

@Component({
  selector: 'app-keypad',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './keypad.component.html',
  styleUrl: './keypad.component.scss'
})
export class KeypadComponent {


  @Output() product_click = new EventEmitter<Product>();
  @Output() paymode_click = new EventEmitter<PaymentMode>();
  @Input() asset: number = 0;

  products_array: Map<string, Product[]> = new Map();
  payment_keypad = PAYMENT_KEYS;


  constructor(
    private productService: ProductService,
  ) {
    this.productService.listProducts().subscribe((products) => {
      this.products_array = this.productService.products_by_accounts(products);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['asset']) {
      console.log(changes['asset'].currentValue);
      if (changes['asset'].currentValue > 0) {

        this.payment_keypad = PAYMENT_KEYS;
      } else {
        this.payment_keypad = PAYMENT_KEYS.filter(key => key.payment_mode !== PaymentMode.ASSETS);
      }
    }
  }

  on_product_click(product: Product) {
    this.product_click.emit(product);
  }

  on_paykey_click(key: Payment_key) {
    this.paymode_click.emit(key.payment_mode);
  }
}
