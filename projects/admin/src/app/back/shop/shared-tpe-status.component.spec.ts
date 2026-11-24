import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { SharedTpeStatusComponent } from './shared-tpe-status.component';
import { SharedTpeRequest, StripeTerminalService } from './services/stripe-terminal.service';
import { TpeReaderIndicatorComponent } from './tpe-reader-indicator.component';

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
    fixture.componentInstance.showAvailability = false;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('TPE disponible');

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

  it('shows the reader connection state and preserves local reader controls', async () => {
    await TestBed.configureTestingModule({ imports: [TpeReaderIndicatorComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TpeReaderIndicatorComponent);
    const component = fixture.componentInstance;
    const retry = spyOn(component.retry, 'emit');
    const disconnect = spyOn(component.disconnect, 'emit');
    fixture.detectChanges();
    const image = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(image.classList.contains('state-disconnected')).toBeTrue();
    expect(image.alt).toBe('TPE hors ligne');
    image.click();
    expect(retry).not.toHaveBeenCalled();

    component.scanning = true;
    fixture.detectChanges();
    expect(image.classList.contains('state-scanning')).toBeTrue();
    expect(image.alt).toContain('Recherche');
    component.scanning = false;
    component.remote = false;
    fixture.detectChanges();
    image.click();
    expect(retry).toHaveBeenCalledTimes(1);

    component.connected = true;
    component.label = 'WisePad test';
    fixture.detectChanges();
    expect(image.classList.contains('state-connected')).toBeTrue();
    expect(image.alt).toContain('WisePad test');
    fixture.nativeElement.querySelector('button').click();
    expect(disconnect).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });
});
