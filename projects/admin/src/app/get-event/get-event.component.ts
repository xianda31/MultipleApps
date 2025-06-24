import { CommonModule, formatDate } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-get-event',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './get-event.component.html',
  styleUrl: './get-event.component.scss'
})
export class GetEventComponent {
  @Output() event: EventEmitter<Date | null> = new EventEmitter();
  date!: string;
  time!: number;

  constructor(
    private activeModal: NgbActiveModal,

  ) {
    this.date = formatDate(new Date(), 'yyyy-MM-dd', 'fr');
  }

  got_it() {

    const date = new Date(this.date);
    date.setHours(this.time, 0, 0, 0);
    this.activeModal.close(date);
  }

  dismiss() {
    this.activeModal.close(null);
  }
}
