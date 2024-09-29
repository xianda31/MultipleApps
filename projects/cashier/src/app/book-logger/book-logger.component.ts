import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { CartItem, Sale } from '../cart/cart.interface';
import { Product } from '../../../../admin-dashboard/src/app/sales/products/product.interface';
import { Member } from '../../../../common/members/member.interface';
import { MembersService } from '../../../../admin-dashboard/src/app/members/service/members.service';
import { ProductService } from '../../../../common/services/product.service';
import { CartService } from '../cart.service';
import { CommonModule } from '@angular/common';


interface BookEntry {
  // payee_id: string;q
  // fullname: string;
  sales: Sale[];
  payment_id: string;
}


@Component({
  selector: 'app-book-logger',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './book-logger.component.html',
  styleUrl: './book-logger.component.scss'
})
export class BookLoggerComponent {
  cart$ !: Observable<CartItem[]>;
  products!: Product[];
  // members!: Member[];

  book_entries: Map<string, BookEntry> = new Map();


  constructor(
    private cartService: CartService,
    private productService: ProductService,
    private membersService: MembersService,

  ) { }
  ngOnInit(): void {
    this.cart$ = this.cartService.getCart();


    this.productService.listProducts().subscribe((products) => {
      this.products = products;
    });

    this.cart$.subscribe((cart) => {
      this.updateSale(cart);
    });


  }

  updateSale(cart: CartItem[]) {
    // list all payees 
    // const payeeIds = cart.map((item) => item.payee_fullname);
    const payees = [...new Set(cart.map((item) => item.payee_fullname))];

    this.book_entries = new Map<string, BookEntry>();

    // for each payee, list all items
    payees.forEach((payee) => {
      let book_entry: BookEntry = { payment_id: 'xxx', sales: [] };

      book_entry.sales = cart
        .filter((item) => item.payee_fullname === payee)
        .map((item) => item.sale);

      this.book_entries.set(payee, book_entry);
    });

    console.log(this.book_entries);
  }


}
