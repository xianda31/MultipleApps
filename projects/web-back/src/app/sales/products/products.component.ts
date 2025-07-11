import { Component, OnDestroy, OnInit } from '@angular/core';
import { ProductService } from '../../../../../common/services/product.service';
import { FormGroup, ReactiveFormsModule, Form, FormControl, Validators, FormsModule } from '@angular/forms';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Product } from './product.interface';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { map, Observable } from 'rxjs';
@Component({
    selector: 'app-products',
    imports: [CommonModule, FormsModule, ReactiveFormsModule,],
    templateUrl: './products.component.html',
    styleUrl: './products.component.scss'
})
export class ProductsComponent implements OnInit, OnDestroy {
  products_subscription: any;
  products: Product[] = [];
  
  productForm!: FormGroup;
  product_selected: boolean = false;
  accounts$ !: Observable<string[]>;

  constructor(
    private productService: ProductService,
    private systemDataService: SystemDataService
  ) { }
  ngOnDestroy(): void {
    this.products_subscription.unsubscribe();
  }

  ngOnInit(): void {

    this.accounts$ = this.systemDataService.get_configuration().pipe(
      map((configuration) => configuration.revenue_and_expense_tree!.revenues),
      map((credit_accounts) => credit_accounts.map((account) => account.key)
      )
    );


    this.products_subscription = this.productService.listProducts().subscribe((products) => {
      this.products = products;
    });

    this.productForm = new FormGroup({
      id: new FormControl(),
      glyph: new FormControl('', Validators.required),
      description: new FormControl('', Validators.required),
      info1: new FormControl(''),
      price: new FormControl('', [Validators.required, Validators.min(0)]),
      account: new FormControl('', Validators.required),
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
    this.productService.createProduct(new_product);
    this.productForm.reset();
    this.product_selected = false;
  }

  onReadProduct(product: Product) {
    this.productForm.patchValue(product);
    this.product_selected = true;
  }

  onModProduct(product: Product) {
    // console.log('mod product', product);
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
