import { Component } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { LicenseStatus, Member } from '../../common/member.interface';
import { CartService } from './cart/cart.service';
import { CommonModule } from '@angular/common';
import { InputMemberComponent } from '../input-member/input-member.component';
import { Expense, Revenue, Session } from '../../common/accounting.interface';
import { BookService } from '../services/book.service';
import { ProductService } from '../../common/services/product.service';
import { AuthentificationService } from '../../common/authentification/authentification.service';
import { TodaysBooksComponent } from './todays-books/todays-books.component';
import { SystemDataService } from '../../common/services/system-data.service';
import { PDF_table } from '../../common/pdf-table.interface';
import { PdfService } from '../../common/services/pdf.service';
import { Product } from '../products/product.interface';
import { CartComponent } from './cart/cart.component';
import { MembersService } from '../../common/members/services/members.service';
import { ToastService } from '../../common/services/toast.service';


@Component({
  selector: 'app-shop',
  imports: [ReactiveFormsModule, CommonModule, FormsModule, InputMemberComponent, CartComponent, TodaysBooksComponent],
  templateUrl: './shop.component.html',
  styleUrl: './shop.component.scss'
})
export class ShopComponent {
  members!: Member[];

  cart_is_valid = true;
  license_paied = false;
  membership_paied = false;
  message: string = '';

  session: Session = { date: '', season: '', };
  debt_amount = 0;
  asset_amount = 0;

  operations: (Revenue | Expense)[] = [];

  products_array: Map<string, Product[]> = new Map();

  logged_member: Member | null = null;
  buyerForm: FormGroup = new FormGroup({
    buyer: new FormControl(null, Validators.required),
  });

  sales_of_the_day_table: PDF_table = {
    title: '',
    headers: [],
    alignments: [],
    rows: []
  };

  get buyer() { return this.buyerForm.get('buyer')?.value as Member | null }


  constructor(
    private cartService: CartService,
    private membersService: MembersService,
    private toastService: ToastService,
    private bookService: BookService,
    private productService: ProductService,
    private auth: AuthentificationService,
    private systemDataService: SystemDataService,
    private pdfService: PdfService,

  ) {

  }

  ngOnInit(): void {

    let today: Date = new Date();
    this.session.date = today.toISOString().split('T')[0]; // format YYYY-MM
    this.session.season = this.systemDataService.get_season(today);
    this.bookService.list_book_entries().subscribe((book_entries) => {
      this.operations = this.bookService.get_operations();
    });

    this.productService.listProducts().subscribe((products) => {
      this.products_array = this.productService.products_by_accounts(products);
    });

    this.membersService.listMembers().subscribe((members) => {
      this.members = members;
    });

    this.auth.logged_member$.subscribe((member) => {
      this.logged_member = member;
      this.cartService.setSeller(member?.firstname ?? 'unknown');
    });



    this.buyerForm.valueChanges.subscribe(async (value) => {
      const buyer: Member | null = value['buyer'];
      if (buyer === null) return;
      this.cartService.clearCart();
      this.cartService.setBuyer(buyer.lastname + ' ' + buyer.firstname);

      this.debt_amount = await this.find_debt(buyer);
      if (this.debt_amount !== 0) {
        this.toastService.showWarning('dette', 'cette personne a une dette de ' + this.debt_amount.toFixed(2) + ' €');
        this.cartService.setDebt(buyer.lastname + ' ' + buyer.firstname, this.debt_amount);
      }

      this.asset_amount = await this.find_assets(buyer);
      if (this.asset_amount !== 0) {
        this.toastService.showInfo('avoir', 'cette personne a un avoir de ' + this.asset_amount.toFixed(2) + ' €');
        this.cartService.setAsset(buyer.lastname + ' ' + buyer.firstname, this.asset_amount);
      }

      this.license_paied = (buyer.license_status === LicenseStatus.DULY_REGISTERED);
      if (!this.license_paied) {
        this.toastService.showWarning('licence', `${buyer.firstname} ${buyer.lastname} n\'a pas de licence pour cette saison`);
      }

      // Check if the buyer has paid the membership fee
      let full_name = this.membersService.full_name(buyer);
      this.membership_paied = this.operations
        .filter((op) => op.member === full_name)
        .some((op) => op.values['ADH']);

      if (!this.membership_paied) {
        this.toastService.showWarning('adhésion', `${buyer.firstname} ${buyer.lastname} n\'a pas payé l\'adhésion au Club`);
      }

      // generate aggregatred message
      this.message ="";
      if(!this.license_paied && !this.membership_paied) {
        this.message = `Adhésion et licence à prendre`;
      }
      else if(!this.license_paied) {
        this.message = `Licence à prendre`;
      }
      else if(!this.membership_paied) {
        this.message = `Adhésion à prendre`;
      }

    });

  }

  on_product_click(product: Product) {

    if (!this.buyerForm.valid) {
      this.toastService.showWarning('saisie achat', 'selectionner un acheteur');
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
    let full_name = this.membersService.first_then_last_name(this.buyer!);
    this.cartService.save_sale(this.session, this.buyer!)
      .then(() => {
        this.toastService.showSuccess('vente à ' + full_name, (this.debt_amount > 0) ? 'achats et dette enregistrés' : 'achats enregistrés');
      })
      .catch((error) => {
        console.error('error saving sale', error);
        this.toastService.showErrorToast('vente', 'erreur lors de l\'enregistrement de la vente');
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
    this.cartService.clearCart();
    this.buyerForm.reset();
  }

  member_name(member_id: string) {
    let member = this.members.find((m) => m.id === member_id);
    return member ? member.lastname + ' ' + member.firstname : '???';
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

  get_sales_table(table: PDF_table) {
    this.sales_of_the_day_table = table;
  }

  tables_to_pdf() {


    let fname = `boutique ${this.session.date}.pdf`;
    this.pdfService.generateTablePDF([this.sales_of_the_day_table], fname);

  }
}
