import { Component, OnDestroy, OnInit } from '@angular/core';
import { ProductService } from '../../../../../common/services/product.service';
import { FormGroup, ReactiveFormsModule, Form, FormControl, Validators } from '@angular/forms';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Product } from './product.interface';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { map, Observable } from 'rxjs';
@Component({
  selector: 'app-products',
  standalone: false,
  // imports: [CurrencyPipe],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss'
})
export class ProductsComponent implements OnInit, OnDestroy {
  products_subscription: any;
  products: Product[] = [];
  productForm!: FormGroup;
  product_selected: boolean = false;
  categories$ !: Observable<string[]>;

  constructor(
    private productService: ProductService,
    private systemDataService: SystemDataService
  ) { }
  ngOnDestroy(): void {
    this.products_subscription.unsubscribe();
  }

  ngOnInit(): void {

    this.categories$ = this.systemDataService.configuration$.pipe(
      map((configuration) => configuration.credit_accounts),
      map((credit_accounts) => credit_accounts.map((account) => account.key)
      )
    );


    this.products_subscription = this.productService.listProducts().subscribe((products) => {
      console.log('products', products);
      this.products = products;
    });

    this.productForm = new FormGroup({
      id: new FormControl(),
      glyph: new FormControl('', Validators.required),
      description: new FormControl('', Validators.required),
      price: new FormControl('', [Validators.required, Validators.min(0)]),
      category: new FormControl('', Validators.required),
      paired: new FormControl<boolean>(false, { nonNullable: true }),
      active: new FormControl<boolean>(true, { nonNullable: true }),
      // color: new FormControl('', Validators.required),
    });

  }
  product_form_filled() {
    return this.productForm.valid;
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
