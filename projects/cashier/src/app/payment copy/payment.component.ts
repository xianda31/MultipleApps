import { Component } from '@angular/core';
import { BookEntry, CartItem } from '../cart/cart.interface';
import { Observable } from 'rxjs';
import { CartService } from '../cart.service';
import { ProductService } from '../../../../common/services/product.service';
import { Product } from '../../../../admin-dashboard/src/app/sales/products/product.interface';
import { MembersService } from '../../../../admin-dashboard/src/app/members/service/members.service';
import { Member } from '../../../../common/members/member.interface';
import { CommonModule, KeyValuePipe } from '@angular/common';

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [CommonModule, KeyValuePipe],
  templateUrl: './payment.component.html',
  styleUrl: './payment.component.scss'
})
export class PaymentComponent {
  cart$ !: Observable<CartItem[]>;
  products!: Product[];
  members!: Member[];

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

    this.membersService.listMembers().subscribe((members) => {
      this.members = members.sort((a, b) => a.lastname.localeCompare(b.lastname))
        .map((member) => {
          member.lastname = member.lastname.toUpperCase();
          return member;
        });
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
