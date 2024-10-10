import { Injectable } from '@angular/core';
import { Payment, Session } from '../cart/cart.interface';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BehaviorSubject, Observable, from, tap, of, map } from 'rxjs';
import { GetEventComponent } from '../get-event/get-event.component';
import { CartService } from '../cart.service';
import { Member } from '../../../../common/members/member.interface';
import { AuthentificationService } from '../../../../common/authentification/authentification.service';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { generateClient } from 'aws-amplify/api';
import { Schema } from '../../../../../amplify/data/resource';

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
          this._current_session = { season: this.season, creator: this.vendor.firstname + ' ' + this.vendor.lastname, event: date.toISOString(), payments: [] };
          console.log('session', this._current_session);
          this._current_session$.next(this._current_session);
          return this._current_session;
        }),
        // tap((session) => {
        //   console.log('session', session);
        // })
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
    console.log('close_sale_session');
    this._current_session = null;
    this.cartService.clearCart();
    this._current_session$.next(this._current_session);
  }


  // session persistence

  async create_session(session: Session): Promise<Session> {
    const client = generateClient<Schema>();
    const result_1 = await client.models.Session.create(session);
    return result_1.data as unknown as Session;
  }

  async update_session(session: Session): Promise<Session> {
    const client = generateClient<Schema>();
    const result = await client.models.Session.update({
      id: session.id!,
      event: session.event,
      season: session.season,
      creator: session.creator
    });
    return result.data as unknown as Session;
  }

  async search_sessions(session: Session): Promise<Session[]> {
    const client = generateClient<Schema>();
    const result = await client.models.Session.list(
      { filter: { season: { eq: session.season }, creator: { eq: session.creator }, event: { eq: session.event } } }
    );
    return result.data as unknown as Session[];
  }

  async list_sessions(season: string): Promise<Session[]> {
    console.log('list sessions of season :', season);
    const client = generateClient<Schema>();
    const result = await client.models.Session.list(
      { selectionSet: ["id", "creator", "event", "payments.*"], filter: { season: { eq: season } } }
    );
    return result.data as unknown as Session[];
  }
}
