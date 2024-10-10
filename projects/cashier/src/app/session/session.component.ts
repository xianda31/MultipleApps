import { Component, EventEmitter, Output } from '@angular/core';
import { Session } from '../cart/cart.interface';
import { SessionService } from './session.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-session',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './session.component.html',
  styleUrl: './session.component.scss'
})
export class SessionComponent {

  @Output() onChangeSession = new EventEmitter<Session | null>();
  session_subscription: any;
  current_session: Session | null = null;

  constructor(
    private sessionService: SessionService,
  ) { }

  ngOnDestroy(): void {
    this.session_subscription.unsubscribe();
  }

  ngOnInit(): void {
    this.new_session();
  }

  renew_session() {
    this.sessionService.close_sale_session();
    this.session_subscription.unsubscribe();
    this.new_session();
  }

  new_session() {
    this.session_subscription = this.sessionService.open_sale_session().subscribe((session: Session | null) => {
      this.current_session = session,
        this.onChangeSession.emit(session);
    });
  }

}
