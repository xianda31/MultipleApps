import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { SharedTpeStatusComponent } from './shared-tpe-status.component';
import { SharedTpeRequest, StripeTerminalService } from './services/stripe-terminal.service';

describe('SharedTpeStatusComponent', () => {
  it('shows availability, occupation and recovery without unlocking an in-flight payment', async () => {
    const request$ = new BehaviorSubject<SharedTpeRequest | null | undefined>(undefined);
    const terminal = {
      sharedTpeEnabled: true,
      sharedRequest$: request$,
      retrySharedTpeObservation: jasmine.createSpy(),
      reconcileSharedTpe: jasmine.createSpy().and.resolveTo('success'),
    };
    await TestBed.configureTestingModule({
      imports: [SharedTpeStatusComponent],
      providers: [{ provide: StripeTerminalService, useValue: terminal }],
    }).compileComponents();
    const fixture = TestBed.createComponent(SharedTpeStatusComponent);
    fixture.componentInstance.connected = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('non vérifié');

    request$.next(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('TPE disponible');

    const request: SharedTpeRequest = {
      id: 'shared-tpe-v1', reservationId: 'owner', origin: 'pointage',
      status: 'processing', paymentIntentId: 'pi_1',
    };
    request$.next(request);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('TPE occupé : pointage');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();

    request$.next({ ...request, status: 'success' });
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(terminal.reconcileSharedTpe).toHaveBeenCalledOnceWith(false);
    expect(fixture.nativeElement.textContent).toContain('Paiement accepté');
    fixture.destroy();
  });
});
