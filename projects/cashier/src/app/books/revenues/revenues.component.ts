import { Component } from '@angular/core';
import { PaymentMode, Session } from '../../cart/cart.interface';
import { CommonModule, formatDate } from '@angular/common';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { map, Observable, of, tap } from 'rxjs';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { SessionService } from '../../session/session.service';


@Component({
  selector: 'app-revenues',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './revenues.component.html',
  styleUrl: './revenues.component.scss'
})
export class RevenuesComponent {
  // payments: Payment[] = [];
  // saleItems: SaleItem[] = [];
  sessions: Session[] = [];
  // by_payment_radio: boolean = true;
  payments_subscription: any;
  sales_subscription: any;
  season_subscription: any;
  payment_mode = PaymentMode;
  season: string = '';
  season$: Observable<string> = of(this.season);
  loaded = false;

  constructor(
    private membersService: MembersService,
    private systemDataService: SystemDataService,
    private sessionService: SessionService,
  ) {
    this.season$ = this.systemDataService.configuration$.pipe(
      map((conf) => conf.season),
      tap((season) => this.season = season)
    );
  }


  ngDestroy() {
    this.season_subscription.unsubscribe();
  }


  ngOnInit(): void {


    this.season_subscription = this.season$.subscribe((season) => {
      this.list_sessions(season);
    });

  }

  list_sessions(season: string) {
    this.sessionService.list_sessions(season)
      .then((sessions) => {
        this.sessions = sessions.sort((a, b) => a.event < b.event ? 1 : -1);
        console.log('sessions', this.sessions);
        this.loaded = true;
      });
  }

  new_season() {
    console.log('new season :', this.season);
    this.list_sessions(this.season);
  }

  member_name(member_id: string) {
    let member = this.membersService.getMember(member_id);
    return member ? member.lastname + ' ' + member.firstname : '???';
  }

  format_date(date: Date): string {
    return formatDate(date, 'EEEE d MMMM HH:00', 'fr-FR');
  }
}

