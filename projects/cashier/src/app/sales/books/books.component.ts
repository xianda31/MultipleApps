import { Component } from '@angular/core';
import { AccountingService } from '../accounting.service';
import { Payment, PaymentMode, SaleItem } from '../../cart/cart.interface';
import { CommonModule, formatDate } from '@angular/common';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { ProductService } from '../../../../../common/services/product.service';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { combineLatest } from 'rxjs';

@Component({
  selector: 'app-books',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './books.component.html',
  styleUrl: './books.component.scss'
})
export class BooksComponent {
  payments: Payment[] = [];
  saleItems: SaleItem[] = [];
  by_payment_radio: boolean = true;
  payments_subscription: any;
  sales_subscription: any;
  both_subscription: any;
  payment_mode = PaymentMode;
  loaded = false;

  constructor(
    private accountingService: AccountingService,
    private membersService: MembersService,
    private productService: ProductService,
  ) { }


  ngDestroy() {
    // this.payments_subscription.unsubscribe();
    // this.sales_subscription.unsubscribe();
    this.both_subscription.unsubscribe();
  }


  ngOnInit(): void {
    this.both_subscription = combineLatest([
      this.accountingService.getPayments(),
      this.accountingService.getSaleItems(),
      this.membersService.listMembers(),
      this.productService.listProducts(),
    ])
      .subscribe(([payments, saleItems, members, products]) => {
        this.payments = payments.filter((payment) => payment.season === '2024/25');
        this.saleItems = saleItems.filter((sale) => sale.season === '2024/25');
        this.loaded = true;
      });
  }



  member_name(member_id: string) {
    let member = this.membersService.getMember(member_id);
    return member ? member.lastname + ' ' + member.firstname : '???';
  }

  getProduct(product_id: string) {
    return this.productService.getProduct(product_id);
  }

  getPayment(payment_id: string): Payment | undefined {
    return this.accountingService.getPayment(payment_id);
  }

  format_date(date: Date): string {
    return formatDate(date, 'EEEE d MMMM HH:00', 'fr-FR');
  }
}
