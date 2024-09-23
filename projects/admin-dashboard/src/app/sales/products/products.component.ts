import { Component, OnDestroy, OnInit } from '@angular/core';
import { ProductService } from '../../../../../common/services/product.service';
import { FormGroup, ReactiveFormsModule, Form, FormControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Product } from './product.interface';
@Component({
  selector: 'app-products',
  standalone: false,
  // imports: [CommonModule,  ReactiveFormsModule],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss'
})
export class ProductsComponent implements OnInit, OnDestroy {
  products_subscription: any;
  products: Product[] = [];
  productForm!: FormGroup;
  product_selected: boolean = false;

  constructor(
    private productService: ProductService,
  ) { }
  ngOnDestroy(): void {
    this.products_subscription.unsubscribe();
  }

  ngOnInit(): void {

    this.products_subscription = this.productService.listProducts().subscribe((products) => {
      console.log('products', products);
      this.products = products;
    });

    this.productForm = new FormGroup({
      id: new FormControl(),
      name: new FormControl(),
      description: new FormControl(),
      price: new FormControl(),
      category: new FormControl(),
      active: new FormControl<boolean>(false),

    });
  }
  onCreateProduct() {
    let new_product = this.productForm.getRawValue();
    console.log('new_product', new_product);
    this.productService.createProduct(new_product);
    this.productForm.reset();
    this.product_selected = false;
  }

  onReadProduct(product: Product) {
    this.productForm.patchValue(product);
    this.product_selected = true;
  }

  onModProduct(product: Product) {
    console.log('mod product', product);
    this.productService.updateProduct(product);

  }
  onUpdateProduct() {
    let product = this.productForm.getRawValue();
    this.productService.updateProduct(product);
    this.product_selected = false;
    this.productForm.reset();
  }

  onDeleteProduct(product: Product) {
    this.productService.deleteProduct(product);
    this.product_selected = false;
    // let { ...deleted_product } = product;
    this.productForm.patchValue(product);   // permet de réafficher le produit supprimé

  }
}