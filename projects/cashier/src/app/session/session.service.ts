import { Injectable } from '@angular/core';
import { Payment, Session } from '../cart/cart.interface';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BehaviorSubject, Observable, from, map } from 'rxjs';
import { GetEventComponent } from '../get-event/get-event.component';
import { CartService } from '../cart.service';
import { Member } from '../../../../common/members/member.interface';
import { AuthentificationService } from '../../../../common/authentification/authentification.service';
import { SystemDataService } from '../../../../common/services/system-data.service';

@Injectable({
  providedIn: 'root'
})
export class SessionService {

  private _current_session: Session | null = null;
  private _current_session$ = new BehaviorSubject<Session | null>(this._current_session);
  private _payments: Payment[] = [];
  private _payments$ = new BehaviorSubject<Payment[]>(this._payments);

  season !: string;
  vendor!: Member;

  constructor(
    private modalService: NgbModal,
    private cartService: CartService,
    private authService: AuthentificationService,
    private SystemDataService: SystemDataService

  ) {

    this.SystemDataService.configuration$.subscribe((conf) => {
      this.season = conf.season;
    });

    this.authService.logged_member$.subscribe((member) => {
      if (member) {
        this.vendor = member;
      }
    });
  }

  open_sale_session(): Observable<Session | null> {

    const set_session = (): Observable<Session | null> => {
      const modalRef = this.modalService.open(GetEventComponent, { centered: true });
      return from(modalRef.result).pipe(
        map((date: Date) => {
          if (date === null) { return null; }
          this._current_session = { season: this.season, vendor: this.vendor.firstname + ' ' + this.vendor.lastname, event: date.toISOString() };
          this._current_session$.next(this._current_session);
          return this._current_session;
        }),

      );
    }
    return (this._current_session !== null) ? (this._current_session$.asObservable()) : set_session();
  }

  push_saleItems_in_session(payment: Payment): void {
    const sale: Payment = { ...payment };
    sale.saleItems = [];
    this.cartService.getCartItems().forEach((item) => { sale.saleItems!.push(item.saleItem) });
    this._payments.push(sale);
    this._payments$.next(this._payments);
  }


  get_sales_in_session(): Observable<Payment[]> {
    return this._payments$.asObservable();
  }

  close_sale_session() {
    this._current_session = null;
    this.cartService.clearCart();
    this._current_session$.next(this._current_session);
  }


}
