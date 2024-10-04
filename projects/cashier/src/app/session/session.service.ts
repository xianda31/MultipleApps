import { Injectable } from '@angular/core';
import { Payment, Session } from '../cart/cart.interface';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BehaviorSubject, Observable, from, tap, of, map } from 'rxjs';
import { GetEventComponent } from '../get-event/get-event.component';
import { CartService } from '../cart.service';
import { Member } from '../../../../common/members/member.interface';

@Injectable({
  providedIn: 'root'
})
export class SessionService {

  private _current_session: Session | null = null;
  private _payments: Payment[] = [];
  private _payments$ = new BehaviorSubject<Payment[]>(this._payments);

  season = '2024/25';
  creator: Member = {
    id: '1', lastname: 'Do', firstname: 'John',
    gender: '',
    license_number: '',
    birthdate: '',
    city: '',
    season: '',
    email: '',
    phone_one: '',
    orga_license_name: '',
    is_sympathisant: false,
    has_account: false
  };


  constructor(
    private modalService: NgbModal,
    private cartService: CartService,

  ) { }

  open_sale_session(): Observable<Session | null> {

    const set_session = (): Observable<Session | null> => {
      const modalRef = this.modalService.open(GetEventComponent, { centered: true });
      return from(modalRef.result).pipe(
        map((date: Date) => {

          if (date === null) {
            return null;
          }
          this._current_session = { season: this.season, creator: this.creator.firstname + '' + this.creator.lastname, event: date, payments: [] };
          return this._current_session;
        }),
        tap((session) => {
          console.log('session', session);
        }
        )
      );
    }
    return (this._current_session !== null) ? of(this._current_session) : set_session();
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
    console.log('close_sale_session');
    this._current_session = null;
  }
}
