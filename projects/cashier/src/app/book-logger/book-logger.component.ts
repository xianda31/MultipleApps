import { Component, Input } from '@angular/core';
import { Payment } from '../sales/sales/cart/cart.interface';
import { MembersService } from '../../../../admin-dashboard/src/app/members/service/members.service';
import { ProductService } from '../../../../common/services/product.service';
import { CartService } from '../cart.service';
import { CommonModule, formatDate } from '@angular/common';
import { Observable, tap } from 'rxjs';


@Component({
  selector: 'app-book-logger',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './book-logger.component.html',
  styleUrl: './book-logger.component.scss'
})
export class BookLoggerComponent {
  // payments: Payment[] = [];
  @Input() event: Date | null = null;
  cart_subscription: any;
  payments$!: Observable<Payment[]>;
  payments_sum: number = 0;

  constructor(
    private cartService: CartService,
    private membersService: MembersService,
    private productService: ProductService,

  ) {
    this.payments$ = this.cartService.payments_of_the_day.pipe(
      // map((payments) => payments.filter((payment) => payment.event === this.event)),
      tap((payments) => {
        this.payments_sum = payments.reduce((acc, payment) => acc + payment.amount, 0);
      })
    )

  }

  member_name(member_id: string) {
    let member = this.membersService.getMember(member_id);
    return member ? member.lastname + ' ' + member.firstname : '???';
  }

  format_date(date: Date): string {
    return formatDate(date, 'EEEE d MMMM HH:00', 'fr-FR');
  }
  getProduct(product_id: string) {
    return this.productService.getProduct(product_id);
  }
  print() {
    window.print();
  }

}
