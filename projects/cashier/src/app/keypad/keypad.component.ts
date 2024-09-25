import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { ProductService } from '../../../../common/services/product.service';
import { Product } from '../../../../admin-dashboard/src/app/sales/products/product.interface';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-keypad',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './keypad.component.html',
  styleUrl: './keypad.component.scss'
})
export class KeypadComponent implements OnInit, OnDestroy {
  @Input() keypad: Product[] = [];
  @Output() keyStroked = new EventEmitter<Product | null>();


  constructor(private productService: ProductService) { }

  ngOnDestroy(): void {
  }

  ngOnInit(): void {
  }

  onClick(product: Product) {
    this.keyStroked.emit(product);
  }
  onClear() {
    this.keyStroked.emit(null);
  }
}
