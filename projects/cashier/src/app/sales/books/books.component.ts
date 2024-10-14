import { Component } from '@angular/core';
import { AccountingService } from '../accounting.service';
import { Payment, PaymentMode, SaleItem, Session } from '../../cart/cart.interface';
import { CommonModule, formatDate } from '@angular/common';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { ProductService } from '../../../../../common/services/product.service';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { combineLatest } from 'rxjs';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { SessionService } from '../../session/session.service';

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
  sessions: Session[] = [];
  by_payment_radio: boolean = true;
  payments_subscription: any;
  sales_subscription: any;
  combo_subscription: any;
  payment_mode = PaymentMode;
  season: string = '';
  loaded = false;

  constructor(
    private accountingService: AccountingService,
    private membersService: MembersService,
    private productService: ProductService,
    private systemDataService: SystemDataService,
    private sessionService: SessionService,
  ) { }


  ngDestroy() {
    // this.payments_subscription.unsubscribe();
    // this.sales_subscription.unsubscribe();
    this.combo_subscription.unsubscribe();
  }


  ngOnInit(): void {

    console.log('books component init');
    this.systemDataService.configuration$.subscribe((conf) => {
      this.season = conf.season;

      this.combo_subscription = combineLatest([
        this.accountingService.getPayments(),
        this.accountingService.getSaleItems(),
        this.membersService.listMembers(),
        this.productService.listProducts(),
        this.sessionService.list_sessions(this.season)

      ])
        .subscribe(([payments, saleItems, members, products, sessions]) => {
          this.payments = payments.filter((payment) => payment);
          this.saleItems = saleItems.filter((sale) => sale);
          this.sessions = sessions.sort((a, b) => a.event < b.event ? 1 : -1);
          console.log('sessions', this.sessions);
          this.loaded = true;
        });

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
