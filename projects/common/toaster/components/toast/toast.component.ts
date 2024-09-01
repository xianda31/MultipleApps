/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { fromEvent, take } from 'rxjs';
import { EventTypes } from '../../models/event-types';
import { Toast } from 'bootstrap'; // Import the 'Toast' class from the 'bootstrap' library.
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.scss'],
})
export class ToastComponent implements OnInit {
  @Output() disposeEvent = new EventEmitter();

  @ViewChild('toastElement', { static: true })
  toastEl!: ElementRef;

  @Input()
  type!: EventTypes;

  @Input()
  title!: string;

  @Input()
  message!: string;

  toast!: Toast;
  class: string = 'toast align-items-center border-0 text-bg-primary ';

  ngOnInit() {
    switch (this.type) {
      case EventTypes.Success:
        this.class += ' bg-success';
        break;
      case EventTypes.Info:
        this.class += ' bg-info';
        break;
      case EventTypes.Warning:
        this.class += ' bg-warning';
        break;
      case EventTypes.Error:
        this.class += ' bg-danger';
        break;
    }
    this.show();
  }

  show() {
    this.toast = new Toast(
      this.toastEl.nativeElement,
      this.type === EventTypes.Error
        ? {
          autohide: false,
        }
        : {
          delay: 1000,
        }
    );

    fromEvent(this.toastEl.nativeElement, 'hidden.bs.toast')
      .pipe(take(1))
      .subscribe(() => this.hide());

    this.toast.show();
  }

  hide() {
    this.toast.dispose();
    this.disposeEvent.emit();
  }
}
