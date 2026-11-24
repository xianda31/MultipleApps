import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppComponent } from '../../../../../pptpe/src/app/app.component';
import { AcrBleReaderService } from '../../../../../pptpe/src/app/nfc/acr-ble-reader.service';
import { NfcTagReaderService, TagScan } from '../../../../../pptpe/src/app/nfc/nfc-tag-reader.service';
import { NfcRelayService } from '../../../../../pptpe/src/app/nfc/nfc-relay.service';

describe('ppTPE reader diagnostic', () => {
  it('shows only the latest UID and time on one line for each reader', () => {
    const scans = signal<readonly TagScan[]>([
      { uid: '04E50142E37384', scannedAt: '2026-01-01T12:34:56' },
      { uid: 'OLDUID', scannedAt: '2026-01-01T12:30:00' },
    ]);
    const reader = { state: signal({ status: 'ready', message: 'Lecteur prêt' }), scans, readError: signal('') };
    const relay = {
      connected: signal(false), collector: signal({ status: 'stopped', tournament: '', message: '' }),
      lastReading: signal(null), buzzerEnabled: signal(false), feedback: signal(null),
    };
    spyOn(AppComponent.prototype, 'ngOnInit');
    spyOn(AppComponent.prototype, 'ngOnDestroy');
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: NfcTagReaderService, useValue: reader },
        { provide: AcrBleReaderService, useValue: reader },
        { provide: NfcRelayService, useValue: relay },
      ],
    });
    const fixture = TestBed.createComponent(AppComponent);
    fixture.nativeElement.style.width = '320px';
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.nfc-diagnostic__last-scan') as NodeListOf<HTMLElement>;
    expect(rows.length).toBe(2);
    for (const row of Array.from(rows)) {
      expect(row.textContent).toContain('04E50142E37384');
      expect(row.textContent).toContain('12:34:56');
      expect(row.parentElement!.textContent).not.toContain('OLDUID');
      const uidBounds = row.querySelector('code')!.getBoundingClientRect();
      const timeBounds = row.querySelector('small')!.getBoundingClientRect();
      expect(uidBounds.width).toBeGreaterThan(0);
      expect(uidBounds.top).toBeLessThan(timeBounds.bottom);
      expect(timeBounds.top).toBeLessThan(uidBounds.bottom);
    }

    scans.set([{ uid: '12345678', scannedAt: '2026-01-01T13:00:00' }]);
    fixture.detectChanges();
    expect(rows[0].textContent).toContain('12345678');
    expect(rows[0].textContent).not.toContain('04E50142E37384');
    fixture.destroy();
  });
});
