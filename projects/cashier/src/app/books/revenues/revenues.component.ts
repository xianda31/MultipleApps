import { Component } from '@angular/core';
import { Payment, PaymentMode } from '../../cart/cart.interface';
import { CommonModule } from '@angular/common';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { map, Observable, of, tap } from 'rxjs';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { Bank } from '../../../../../common/system-conf.interface';
import { ExcelService } from '../../excel.service';
import { AccountingService } from '../../sales/accounting.service';


@Component({
  selector: 'app-revenues',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './revenues.component.html',
  styleUrl: './revenues.component.scss'
})
export class RevenuesComponent {
  payments: Payment[] = [];
  // saleItems: SaleItem[] = [];
  // sessions: Session[] = [];
  // by_payment_radio: boolean = true;
  payments_subscription: any;
  sales_subscription: any;
  season_subscription: any;
  payment_mode = PaymentMode;
  season: string = '';
  banks !: Bank[];
  season$: Observable<string> = of(this.season);
  loaded = false;

  constructor(
    private membersService: MembersService,
    private systemDataService: SystemDataService,
    private accountingService: AccountingService,
    private excelService: ExcelService
  ) {
    this.season$ = this.systemDataService.configuration$.pipe(
      tap((conf) => {
        this.season = conf.season;
        this.banks = conf.banks;

      }),
      map((conf) => conf.season),
    );
  }


  ngDestroy() {
    this.season_subscription.unsubscribe();
  }


  ngOnInit(): void {


    this.season_subscription = this.season$.subscribe((season) => {
      this.list_payments(season);
    });

  }

  // list_sessions(season: string) {
  //   this.sessionService.list_sessions(season)
  //     .then((sessions) => {
  //       this.sessions = sessions.sort((a, b) => a.event > b.event ? 1 : -1);
  //       console.log('sessions', this.sessions);
  //       this.loaded = true;
  //     });
  // }

  list_payments(season: string) {
    this.payments_subscription = this.accountingService.getPayments(season)
      .subscribe((payments) => {
        this.payments = payments.sort((a, b) => a.event > b.event ? 1 : -1);
      });
  }

  new_season(event: any) {
    this.payments_subscription.unsubscribe();
    let season = event.target.value;
    this.list_payments(season);
  }

  member_name(member_id: string) {
    let member = this.membersService.getMember(member_id);
    return member ? member.lastname.toLocaleUpperCase() + ' ' + member.firstname : '???';
  }

  bank_name(bank_key: string) {
    let bank = this.banks.find((bank) => bank.key === bank_key);
    return bank ? bank.name : '???';
  }

  format_date(date: string): string {
    const formated_date = new Date(date);
    // return formatDate(date, 'EEEE d MMMM HH:00', 'fr-FR');
    return formated_date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric' });
  }

  format_vendor(vendor: string): string {
    const gliph = vendor.toLocaleLowerCase().split(' ').map((word) => word[0]).join('');
    return gliph;
  }

  color_swapper(i: number) {
    return i % 2 === 0 ? 'table-light' : 'table-primary';
  }

  export_excel() {
    let data: any[] = [];
    this.payments.forEach((payment) => {
      data.push({
        date: this.format_date(payment.event),
        montant: payment.amount,
        bénéficiaire: this.member_name(payment.payer_id),
        payment_mode: payment.payment_mode,
      });
    });
    this.excelService.generateExcel(data, 'revenues');
  }
}

