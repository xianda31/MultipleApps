import { Component, OnDestroy, OnInit } from '@angular/core';
import { ProductService } from '../../../../common/services/product.service';
import { Product } from '../../../../admin-dashboard/src/app/sales/products/product.interface';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-keypad',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './keypad.component.html',
  styleUrl: './keypad.component.scss'
})
export class KeypadComponent implements OnInit, OnDestroy {
  products_subscription: any;
  products: Product[] = [];

  constructor(private productService: ProductService) { }

  ngOnDestroy(): void {
    this.products_subscription.unsubscribe();
  }

  ngOnInit(): void {

    this.products_subscription = this.productService.listProducts().subscribe((products) => {
      console.log('products', products);
      this.products = products;
    });
  }
}
