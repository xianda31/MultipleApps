import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormGroup, ReactiveFormsModule, FormControl, Validators, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Product } from './product.interface';
import { map, Observable } from 'rxjs';
import { ProductService } from '../../common/services/product.service';
import { SystemDataService } from '../../common/services/system-data.service';
import { CustomDropdownComponent } from '../../common/components/custom-dropdown/custom-dropdown.component';
import { getGlyphForAccount } from '../../common/utilities/account-glyph.mapper';
@Component({
  selector: 'app-products',
  standalone: true,
    imports: [CommonModule, FormsModule, ReactiveFormsModule, CustomDropdownComponent],
    templateUrl: './products.component.html',
    styleUrl: './products.component.scss'
})
export class ProductsComponent implements OnInit, OnDestroy {
  products_subscription: any;
  products: Product[] = [];
  showModal = false;
  
  productForm!: FormGroup;
  product_selected: boolean = false;
  accounts$ !: Observable<string[]>;

  accountInput: string = '';
  showAccountSuggestions: boolean = false;
  displayAccountFn = (account: string) => account;

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
      this.products = [...products].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'fr'));
    });

    this.productForm = new FormGroup({
      id: new FormControl(),
      name: new FormControl('', Validators.required),
      description: new FormControl('', Validators.required),
      price: new FormControl('', [Validators.required, Validators.min(0)]),
      account: new FormControl('', Validators.required),
      paired: new FormControl<boolean>(false, { nonNullable: true }),
      currency: new FormControl('EUR', Validators.required),
      stripeEnabled: new FormControl<boolean>(false, { nonNullable: true }),
      active: new FormControl<boolean>(true, { nonNullable: true }),
      // glyph est auto-déterminé basé sur `account` — ne pas inclure dans le formulaire
    });

  }
  product_form_filled() {
    return this.productForm.valid;
  }

  onNewProduct() {
    this.productForm.reset({ paired: false, stripeEnabled: false, active: true, currency: 'EUR' });
    this.accountInput = '';
    this.product_selected = false;
    this.showModal = true;
  }

  onCloseModal() {
    this.showModal = false;
    this.productForm.reset();
    this.product_selected = false;
  }

  onCreateProduct() {
    let new_product = this.productForm.getRawValue();
    // Déterminer auto le glyph basé sur le compte
    new_product.glyph = getGlyphForAccount(new_product.account);
    this.productService.createProduct(new_product);
    this.showModal = false;
    this.productForm.reset();
    this.product_selected = false;
  }

  onReadProduct(product: Product) {
    this.productForm.patchValue(product);
    this.accountInput = product.account ?? '';
    this.product_selected = true;
    this.showModal = true;
  }

  onModProduct(product: Product) {
    // console.log('mod product', product);
    this.productService.updateProduct(product);

  }
  onUpdateProduct() {
    let product = this.productForm.getRawValue();
    // Déterminer auto le glyph basé sur le compte
    product.glyph = getGlyphForAccount(product.account);
    this.productService.updateProduct(product);
    this.showModal = false;
    this.product_selected = false;
    this.productForm.reset();
  }

  onDeleteProduct(product: Product) {
    if (!confirm(`Supprimer "${product.name}" ?`)) return;
    this.productService.deleteProduct(product);
    this.product_selected = false;
    this.productForm.reset();
  }

  // Gestion du dropdown custom compte
  onAccountInputChange(value: string) {
    this.accountInput = value;
    this.showAccountSuggestions = true;
  }

  selectAccount(account: string) {
    this.accountInput = account;
    this.productForm.get('account')?.setValue(account);
    this.showAccountSuggestions = false;
  }

  hideAccountSuggestionsDelay() {
    setTimeout(() => { this.showAccountSuggestions = false; }, 200);
  }

}
