import { Component } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MembersService } from '../../../../admin-dashboard/src/app/members/service/members.service';
import { Member } from '../../../../common/member.interface';
import { ToastService } from '../../../../common/toaster/toast.service';
import { CartService } from './cart/cart.service';
import { Product } from '../../../../admin-dashboard/src/app/sales/products/product.interface';
import { CommonModule } from '@angular/common';
import { InputMemberComponent } from '../input-member/input-member.component';
import { BookEntry, Revenue, Session } from '../../../../common/accounting.interface';
import { BookService } from '../book.service';
import { CartComponent } from "./cart/cart.component";
import { ProductService } from '../../../../common/services/product.service';
import { get_transaction } from '../../../../common/transaction.definition';
import { SystemConfiguration } from '../../../../common/system-conf.interface';
import { SystemDataService } from '../../../../common/services/system-data.service';


@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, FormsModule, InputMemberComponent, CartComponent],
  templateUrl: './shop.component.html',
  styleUrl: './shop.component.scss'
})
export class ShopComponent {
  members!: Member[];

  cart_is_valid = true;

  session!: Session;
  debt_amount = 0;
  asset_amount = 0;

  products_array: Map<string, Product[]> = new Map();
  book_entries: BookEntry[] = [];
  sales_of_the_day: Revenue[] = [];


  buyerForm: FormGroup = new FormGroup({
    buyer: new FormControl(null, Validators.required),
  });


  get buyer() { return this.buyerForm.get('buyer')?.value as Member | null }


  constructor(
    private cartService: CartService,
    private membersService: MembersService,
    private toastService: ToastService,
    private bookService: BookService,
    private productService: ProductService,
    private systemDataService: SystemDataService
  ) {
    this.session = {
      season: '',
      date: new Date().toISOString().split('T')[0],
    };

    this.systemDataService.get_configuration().subscribe((conf: SystemConfiguration) => {
      this.session.season = conf.season;
      this.bookService.list_book_entries$(conf.season).subscribe((book_entry) => {
        this.book_entries = book_entry;
        this.sales_of_the_day = this.bookService.get_revenues_from_members().filter((revenue) => revenue.date === this.session.date);
        // this.sales_to_members.set(this.bookService.get_revenues_from_members());
      });
    })
  }

  ngOnInit(): void {
    this.productService.listProducts().subscribe((products) => {
      this.products_array = this.productService.products_by_accounts(products);
    });

    this.membersService.listMembers().subscribe((members) => {
      this.members = members;
    });



    this.buyerForm.valueChanges.subscribe(async (value) => {
      const buyer: Member | null = value['buyer'];
      if (buyer === null) return;
      this.cartService.clearCart();
      this.cartService.setBuyer(buyer.lastname + ' ' + buyer.firstname);

      this.debt_amount = await this.find_debt(buyer);
      if (this.debt_amount !== 0) {
        this.toastService.showWarningToast('dette', 'cette personne a une dette de ' + this.debt_amount.toFixed(2) + ' €');
        this.cartService.setDebt(buyer.lastname + ' ' + buyer.firstname, this.debt_amount);
      }

      this.asset_amount = await this.find_assets(buyer);
      if (this.asset_amount !== 0) {
        this.toastService.showInfoToast('avoir', 'cette personne a un avoir de ' + this.asset_amount.toFixed(2) + ' €');
        this.cartService.setAsset(buyer.lastname + ' ' + buyer.firstname, this.asset_amount);
      }

    });

  }

  on_product_click(product: Product) {

    if (!this.buyerForm.valid) {
      this.toastService.showWarningToast('saisie achat', 'selectionner un acheteur');
      return;
    }

    if (product.paired) {
      const cart_item1 = this.cartService.build_cart_item(product, this.buyer);
      const cart_item2 = this.cartService.build_cart_item(product, null);
      this.cartService.addToCart(cart_item1);
      this.cartService.addToCart(cart_item2);
    } else {
      const cart_item1 = this.cartService.build_cart_item(product, this.buyer);
      this.cartService.addToCart(cart_item1);
    }
  }

  cart_confirmed(): void {
    this.cartService.save_sale(this.session, this.buyer!)
      .then(() => {
        this.toastService.showSuccessToast('vente', (this.debt_amount > 0) ? 'achats et dette enregistrés' : 'achats enregistrés');
      })
      .catch((error) => {
        console.error('error saving sale', error);
      });
    this.buyerForm.reset();
  }

  clear_sale(): void {
    this.cartService.clearCart();
    this.buyerForm.reset();
    this.debt_amount = 0;
    this.asset_amount = 0;
  }

  date_change(date: any) {
    this.session.date = new Date(date).toISOString().split('T')[0]; //new Date().toISOString().split('T')[0])
    this.sales_of_the_day = this.bookService.get_revenues_from_members().filter((revenue) => revenue.date === this.session.date);

    this.cartService.clearCart();
    this.buyerForm.reset();
  }

  member_name(member_id: string) {
    let member = this.members.find((m) => m.id === member_id);
    return member ? member.lastname + ' ' + member.firstname : '???';
  }

  sale_amount(sale: Revenue): number {
    let book_entry = this.book_entries.find((entry) => entry.id === sale.id);
    if (!book_entry) throw new Error('sale not found');
    return (book_entry.amounts?.['cashbox_in'] ?? 0) + (book_entry.amounts?.['bank_in'] ?? 0);
  }

  standalone_sale(index: number): boolean {
    if (index === 0) return true;
    let sale = this.sales_of_the_day[index];
    let prev = this.sales_of_the_day[index - 1];
    return sale.id !== prev.id;
  }
  payment_type(sale: Revenue): string {
    let book_entry = this.book_entries.find((entry) => entry.id === sale.id);
    if (!book_entry) throw new Error('sale not found');
    return get_transaction(book_entry.bank_op_type).label;
  }


  find_debt(payer: Member): Promise<number> {
    let name = payer.lastname + ' ' + payer.firstname;
    let due = this.bookService.find_member_debt(name);
    return Promise.resolve(due);
  }

  find_assets(payer: Member): Promise<number> {
    let name = payer.lastname + ' ' + payer.firstname;
    let due = this.bookService.find_assets(name);
    return Promise.resolve(due);
  }
}
