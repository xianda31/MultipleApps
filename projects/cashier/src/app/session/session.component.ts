import { Component, EventEmitter, Output } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BehaviorSubject, from, map, Observable, tap } from 'rxjs';
import { GetEventComponent } from '../get-event/get-event.component';
import { Payment, Session } from '../cart/cart.interface';
import { SessionService } from './session.service';
import { CommonModule } from '@angular/common';
import { Form, FormsModule } from '@angular/forms';

@Component({
  selector: 'app-session',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './session.component.html',
  styleUrl: './session.component.scss'
})
export class SessionComponent {

  @Output() session = new EventEmitter<Session | null>();
  session_subscription: any;
  current_session: Session | null = null;

  constructor(
    private sessionService: SessionService,
  ) { }

  ngOnDestroy(): void {
    this.session_subscription.unsubscribe();
  }

  ngOnInit(): void {
    this.session_subscription = this.sessionService.open_sale_session().subscribe((session: Session | null) => {
      console.log('session', session);
      this.current_session = session,
        this.session.emit(session);
    });
  }
}
