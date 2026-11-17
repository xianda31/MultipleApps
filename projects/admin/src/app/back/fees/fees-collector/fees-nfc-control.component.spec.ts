import { fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { Member } from '../../../common/interfaces/member.interface';
import {
  MemberNfcCard, MemberNfcCardService, NfcCaptureTimeoutError,
} from '../../../common/services/member-nfc-card.service';
import { MembersService } from '../../../common/services/members.service';
import { ToastService } from '../../../common/services/toast.service';
import { FEE_RATE, Game, Gamer } from '../fees.interface';
import { FeesCollectorService } from './fees-collector.service';
import { FeesNfcControlComponent } from './fees-nfc-control.component';

describe('FeesNfcControlComponent', () => {
  const uid = '04E50142E37384';
  const card: MemberNfcCard = {
    uid, licenseNumber: '00000001', status: 'ACTIVE', kind: 'WHITE', stockState: 'ASSIGNED',
    assignedAt: null, assignedBy: null, createdAt: '2026-11-16T08:00:00Z', updatedAt: '2026-11-16T08:00:00Z',
  };
  function waitingForAbort(signal: AbortSignal): Promise<string> {
    return new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Lecture annulée', 'AbortError')), { once: true });
    });
  }
  function setup() {
    const gamer: Gamer = {
      license: '00000001', firstname: 'Jean', lastname: 'Exemple', is_member: true,
      game_credits: 2, debt: 0, credit: 0, index: 0, in_euro: false, price: 3,
      validated: false, enabled: true, photo_url$: null, member_id: 'one', my_birthday: null,
    };
    const game: Game = {
      season: '2026', fee_rate: FEE_RATE.STANDARD, member_trn_price: 3, non_member_trn_price: 5,
      fees_doubled: false, alphabetic_sort: false,
      tournament: { id: 1, name: 'Tournoi test', date: '2026-11-16', time: '14:00' }, gamers: [gamer],
    };
    const member: Member = {
      id: 'one', license_number: gamer.license, lifecycleStatus: 'ACTIVE', firstname: 'Jean', lastname: 'Exemple',
      gender: 'M', birthdate: '', city: '', email: '', phone_one: '', license_status: '',
      license_taken_at: '', membership_date: '', accept_mailing: false,
    };
    const bridge = jasmine.createSpyObj<MemberNfcCardService>('MemberNfcCardService', ['status', 'acquire', 'get']);
    bridge.status.and.resolveTo({
      version: '1.0', readerStatus: 'Ready', readerName: 'ACR1555U', message: 'Déclaré par Windows', capturing: false,
    });
    let first = true;
    bridge.acquire.and.callFake(signal => {
      if (first) { first = false; return Promise.resolve(uid); }
      return waitingForAbort(signal);
    });
    bridge.get.and.resolveTo(card);
    const members = jasmine.createSpyObj<MembersService>('MembersService', ['readMember']);
    members.readMember.and.resolveTo(member);
    const fees = jasmine.createSpyObj<FeesCollectorService>('FeesCollectorService', ['checkInByNfc'], { nfcCheckInEnabled: true });
    fees.checkInByNfc.and.resolveTo(true);
    const toast = jasmine.createSpyObj<ToastService>('ToastService', ['showSuccess', 'showWarning']);
    const component = new FeesNfcControlComponent(bridge, members, fees, toast);
    component.game = game;
    return { component, bridge, members, fees, game, gamer, member, toast };
  }

  it('keeps diagnostics and a read-only test available with euro priority', async () => {
    const { bridge, members, fees, game, toast } = setup();
    Object.assign(fees, { sys_conf: { trace_mode: true } });
    await TestBed.configureTestingModule({
      imports: [FeesNfcControlComponent],
      providers: [
        { provide: MemberNfcCardService, useValue: bridge },
        { provide: MembersService, useValue: members },
        { provide: FeesCollectorService, useValue: fees },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(FeesNfcControlComponent);
    fixture.componentRef.setInput('game', game);
    fixture.componentRef.setInput('paymentPreference', 'euro');
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    root.style.height = '80px';
    root.style.overflow = 'hidden';
    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();
    await fixture.componentInstance.testRead();
    fixture.detectChanges();
    const panel = document.body.querySelector<HTMLElement>('.nfc-panel')!;
    expect(root.contains(panel)).toBeFalse();
    expect(panel.getBoundingClientRect().height).toBeGreaterThan(0);
    expect(panel.getBoundingClientRect().height).toBeLessThan(window.innerHeight);
    expect(getComputedStyle(panel).overflowY).toBe('auto');
    expect(panel.textContent).toContain('Joignable');
    expect(panel.textContent).toContain('Déclaré disponible par Windows');
    expect(panel.textContent).toContain('priorité Euro');
    expect(panel.textContent).toContain('aucun pointage effectué');
    const activate = Array.from(panel.querySelectorAll('button')).find(button => button.textContent?.includes('Activer le pointage'));
    expect(activate?.disabled).toBeTrue();
    expect(bridge.get).not.toHaveBeenCalled();
    expect(fees.checkInByNfc).not.toHaveBeenCalled();
    expect(toast.showSuccess).not.toHaveBeenCalled();
    expect(toast.showWarning).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('binds reads to the selected tournament and delegates card pointage, then stops reading', fakeAsync(() => {
    const { component, bridge, fees } = setup();
    const checkedIn = spyOn(component.checkedIn, 'emit');
    void component.startSession();
    flushMicrotasks();
    expect(component.active).toBeTrue();
    expect(fees.checkInByNfc).toHaveBeenCalledOnceWith('00000001', jasmine.any(AbortSignal));
    expect(component.lastReading?.accepted).toBeTrue();
    expect(checkedIn).toHaveBeenCalledTimes(1);
    expect(bridge.acquire).toHaveBeenCalledTimes(2);
    component.stopSession();
    flushMicrotasks();
    expect(component.active).toBeFalse();
    expect(component.sessionPending).toBeFalse();
    expect(bridge.acquire).toHaveBeenCalledTimes(2);
  }));

  it('starts pointage automatically for an eligible tournament without opening the panel', fakeAsync(() => {
    const { component, fees } = setup();
    component.ngOnChanges();
    flushMicrotasks();
    expect(component.panelOpen).toBeFalse();
    expect(component.active).toBeTrue();
    expect(fees.checkInByNfc).toHaveBeenCalledOnceWith('00000001', jasmine.any(AbortSignal));
    component.stopSession();
    flushMicrotasks();
  }));

  for (const restriction of ['euro', 'locked']) {
    it(`starts automatically only after the ${restriction} restriction is lifted`, fakeAsync(() => {
      const { component, bridge } = setup();
      bridge.acquire.and.callFake(waitingForAbort);
      if (restriction === 'euro') component.paymentPreference = 'euro';
      else component.blocked = true;
      component.ngOnChanges();
      flushMicrotasks();
      expect(bridge.status).not.toHaveBeenCalled();
      component.paymentPreference = 'card';
      component.blocked = false;
      component.ngOnChanges();
      flushMicrotasks();
      expect(component.active).toBeTrue();
      component.stopSession();
      flushMicrotasks();
    }));
  }

  it('preserves a manual pause across pointage updates and resumes only on request or a different tournament', fakeAsync(() => {
    const { component, bridge, game } = setup();
    bridge.acquire.and.callFake(waitingForAbort);
    component.ngOnChanges();
    flushMicrotasks();
    component.stopSession();
    flushMicrotasks();
    component.game = { ...game };
    component.ngOnChanges();
    component.paymentPreference = 'euro';
    component.ngOnChanges();
    component.paymentPreference = 'card';
    component.ngOnChanges();
    flushMicrotasks();
    expect(component.paused).toBeTrue();
    expect(component.active).toBeFalse();
    expect(bridge.status).toHaveBeenCalledTimes(1);
    void component.startSession();
    flushMicrotasks();
    expect(component.active).toBeTrue();
    expect(component.paused).toBeFalse();
    expect(bridge.status).toHaveBeenCalledTimes(2);
    component.stopSession();
    flushMicrotasks();
    if (game.tournament) component.game = { ...game, tournament: { ...game.tournament, id: 2 } };
    component.ngOnChanges();
    flushMicrotasks();
    expect(component.active).toBeTrue();
    expect(component.paused).toBeFalse();
    expect(bridge.status).toHaveBeenCalledTimes(3);
    component.stopSession();
    flushMicrotasks();
  }));

  it('finishes cancelling the old tournament before automatically starting the next one', fakeAsync(() => {
    const { component, bridge, fees, game } = setup();
    let resolve!: (value: MemberNfcCard) => void;
    bridge.get.and.returnValue(new Promise(done => { resolve = done; }));
    component.ngOnChanges();
    flushMicrotasks();
    if (game.tournament) component.game = { ...game, tournament: { ...game.tournament, id: 2 } };
    component.ngOnChanges();
    component.game = { ...component.game };
    component.ngOnChanges();
    flushMicrotasks();
    expect(component.active).toBeFalse();
    expect(bridge.status).toHaveBeenCalledTimes(1);
    resolve(card);
    flushMicrotasks();
    expect(fees.checkInByNfc).not.toHaveBeenCalled();
    expect(bridge.status).toHaveBeenCalledTimes(2);
    expect(component.active).toBeTrue();
    expect(bridge.acquire.calls.mostRecent().args[0].aborted).toBeFalse();
    component.stopSession();
    flushMicrotasks();
  }));

  it('does not retry a failed automatic activation on every pointage update', fakeAsync(() => {
    const { component, bridge, game } = setup();
    bridge.status.and.rejectWith(new Error('ppNFC indisponible'));
    component.ngOnChanges();
    flushMicrotasks();
    component.game = { ...game };
    component.ngOnChanges();
    flushMicrotasks();
    expect(bridge.status).toHaveBeenCalledTimes(1);
    expect(component.active).toBeFalse();
    expect(component.error).toBe('ppNFC indisponible');
  }));

  for (const traceMode of [false, true]) {
    it(`shows a pointage confirmation toast only in trace mode (trace: ${traceMode})`, fakeAsync(() => {
      const { component, fees, toast } = setup();
      Object.assign(fees, { sys_conf: { trace_mode: traceMode } });
      void component.startSession();
      flushMicrotasks();
      if (traceMode) {
        expect(toast.showSuccess).toHaveBeenCalledOnceWith(
          'Pointage NFC', jasmine.stringMatching(/Jean Exemple.*pointage carte confirmé.*04E50142E37384/),
        );
      } else {
        expect(toast.showSuccess).not.toHaveBeenCalled();
      }
      expect(toast.showWarning).not.toHaveBeenCalled();
      component.stopSession();
      flushMicrotasks();
    }));
  }

  it('shows an unknown-card refusal toast in trace mode without claiming a pointage', fakeAsync(() => {
    const { component, bridge, fees, toast } = setup();
    Object.assign(fees, { sys_conf: { trace_mode: true } });
    bridge.get.and.resolveTo(null);
    void component.startSession();
    flushMicrotasks();
    expect(toast.showWarning).toHaveBeenCalledOnceWith('Pointage NFC', jasmine.stringMatching(/Carte inconnue.*04E50142E37384/));
    expect(toast.showSuccess).not.toHaveBeenCalled();
    expect(fees.checkInByNfc).not.toHaveBeenCalled();
    component.stopSession();
    flushMicrotasks();
  }));

  it('does not re-open completion for an already checked-in player or claim success after a refusal', fakeAsync(() => {
    const { component, fees, gamer } = setup();
    gamer.validated = true;
    fees.checkInByNfc.and.resolveTo(false);
    const checkedIn = spyOn(component.checkedIn, 'emit');
    void component.startSession();
    flushMicrotasks();
    expect(component.lastReading?.accepted).toBeFalse();
    expect(component.lastReading?.message).toContain('refusé ou non confirmé');
    expect(checkedIn).not.toHaveBeenCalled();
    component.stopSession();
    flushMicrotasks();
  }));

  for (const refusal of ['unknown', 'disabled', 'unregistered', 'inactive']) {
    it(`rejects ${refusal} card ownership before any pointage`, fakeAsync(() => {
      const { component, bridge, members, fees, game, member } = setup();
      if (refusal === 'unknown') bridge.get.and.resolveTo(null);
      if (refusal === 'disabled') bridge.get.and.resolveTo({ ...card, status: 'DISABLED' });
      if (refusal === 'unregistered') game.gamers = [];
      if (refusal === 'inactive') members.readMember.and.resolveTo({ ...member, lifecycleStatus: 'ARCHIVED' });
      void component.startSession();
      flushMicrotasks();
      expect(component.lastReading?.accepted).toBeFalse();
      expect(component.lastReading?.message).toBeTruthy();
      expect(fees.checkInByNfc).not.toHaveBeenCalled();
      component.stopSession();
      flushMicrotasks();
    }));
  }

  for (const interruption of ['destroy', 'pagehide', 'euro', 'blocked']) {
    it(`aborts a pending capture on ${interruption} without pointing the next card`, fakeAsync(() => {
      const { component, bridge, fees } = setup();
      bridge.acquire.and.callFake(waitingForAbort);
      component.ngOnChanges();
      flushMicrotasks();
      if (interruption === 'destroy') component.ngOnDestroy();
      if (interruption === 'pagehide') component.leavePage();
      if (interruption === 'euro') component.paymentPreference = 'euro';
      if (interruption === 'blocked') component.blocked = true;
      component.ngOnChanges();
      flushMicrotasks();
      expect(bridge.acquire.calls.mostRecent().args[0].aborted).toBeTrue();
      expect(component.active).toBeFalse();
      expect(component.sessionPending).toBeFalse();
      expect(fees.checkInByNfc).not.toHaveBeenCalled();
    }));
  }

  it('does not point a card if stopped while its holder is being resolved', fakeAsync(() => {
    const { component, bridge, fees } = setup();
    let resolve!: (value: MemberNfcCard) => void;
    bridge.get.and.returnValue(new Promise(done => { resolve = done; }));
    void component.startSession();
    flushMicrotasks();
    component.stopSession();
    resolve(card);
    flushMicrotasks();
    expect(fees.checkInByNfc).not.toHaveBeenCalled();
    expect(component.sessionPending).toBeFalse();
  }));

  it('continues waiting through an idle capture but stops with an explicit error on disconnection', fakeAsync(() => {
    const { component, bridge, fees } = setup();
    let calls = 0;
    bridge.acquire.and.callFake(() => {
      calls++;
      return Promise.reject(calls === 1 ? new NfcCaptureTimeoutError('Aucune carte') : new Error('Lecteur déconnecté'));
    });
    void component.startSession();
    flushMicrotasks();
    expect(bridge.acquire).toHaveBeenCalledTimes(2);
    expect(fees.checkInByNfc).not.toHaveBeenCalled();
    expect(component.active).toBeFalse();
    expect(component.error).toBe('Lecteur déconnecté');
  }));

  it('stops a pending capture if a status refresh reports a disconnected reader', fakeAsync(() => {
    const { component, bridge } = setup();
    bridge.acquire.and.callFake(waitingForAbort);
    void component.startSession();
    flushMicrotasks();
    bridge.status.and.resolveTo({
      version: '1.0', readerStatus: 'Disconnected', readerName: null, message: 'Absent', capturing: false,
    });
    void component.refreshStatus();
    flushMicrotasks();
    expect(component.active).toBeFalse();
    expect(bridge.acquire.calls.mostRecent().args[0].aborted).toBeTrue();
    expect(component.notice).toContain('lecteur est indisponible');
  }));

  it('does not take over a reader already capturing in another tab', fakeAsync(() => {
    const { component, bridge } = setup();
    bridge.status.and.resolveTo({
      version: '1.0', readerStatus: 'Ready', readerName: 'ACR1555U', message: '', capturing: true,
    });
    void component.startSession();
    flushMicrotasks();
    expect(component.active).toBeFalse();
    expect(bridge.acquire).not.toHaveBeenCalled();
    expect(component.error).toContain('autre écran ou onglet');
  }));
});
