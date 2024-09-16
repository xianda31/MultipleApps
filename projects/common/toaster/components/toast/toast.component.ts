/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Component, ElementRef, EventEmitter, Input, NgModule, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EventTypes } from '../../models/event-types';
import { ToastEvent } from '../../models/toast-event';
// import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { fromEvent, take } from 'rxjs';
import Toast from 'bootstrap/js/dist/toast';
// import { Toast } from 'bootstrap';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.scss'],
})
export class ToastComponent implements OnChanges {
  @Output() disposeEvent = new EventEmitter();

  @ViewChild('toastPattern', { static: true }) toastEl!: ElementRef;

  @Input() event !: ToastEvent;
  toast!: Toast;

  // toast!: Toast;
  class: string = 'toast  align-items-center border-0 text-bg-primary ';

  constructor() {
  }

  ngOnChanges(changes: SimpleChanges): void {
    // console.log('toast', this.event);
    switch (this.event.type) {
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
      this.event.type === EventTypes.Error ? { autohide: false, } : { delay: 8000, });

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
