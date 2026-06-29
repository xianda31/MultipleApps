import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ToastEvent } from '../../models/toast-event';
import { CommonModule } from '@angular/common';
import { ToastComponent } from '../toast/toast.component';
import { ToastService } from '../../../services/toast.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-toaster',
  standalone: true,
  imports: [CommonModule, ToastComponent],
  templateUrl: './toaster.component.html',
  styleUrls: ['./toaster.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToasterComponent implements OnInit, OnDestroy {
  currentToasts: ToastEvent[] = [];
  private readonly destroyed$ = new Subject<void>();

  constructor(
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.subscribeToToasts();
  }

  ngOnDestroy() {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  subscribeToToasts() {
    this.toastService.toastEvents.pipe(takeUntil(this.destroyed$)).subscribe((toasts) => {
      const currentToast: ToastEvent = {
        type: toasts.type,
        title: toasts.title,
        message: toasts.message,
      };

      this.currentToasts.push(currentToast);
      this.cdr.markForCheck();
    });
  }

  dispose(index: number) {
    this.currentToasts.splice(index, 1);
    this.cdr.markForCheck();
  }
}
