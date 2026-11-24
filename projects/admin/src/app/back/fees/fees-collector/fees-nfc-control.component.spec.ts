import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { Member } from '../../../common/interfaces/member.interface';
import {
  MemberNfcCard, MemberNfcCardService, NfcCaptureTimeoutError,
} from '../../../common/services/member-nfc-card.service';
import { MembersService } from '../../../common/services/members.service';
import { TabletNfcBridgeService } from '../../../common/services/tablet-nfc-bridge.service';
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
    const tablet = jasmine.createSpyObj<TabletNfcBridgeService>('TabletNfcBridgeService',
      ['status', 'watch', 'unwatch', 'acquire', 'report', 'reportRead', 'publishCollector']);
    tablet.status.and.resolveTo({
      version: 'ppTPE', readerStatus: 'Ready', readerName: 'ACR1555U-A1-001714 PICC', message: 'Lecteur prêt',
      capturing: false, sessionId: 'tablet-1',
      hardwareProbe: { state: 'Responsive', pcdPiccStatus: 1, message: 'Lecteur connecté à la tablette ppTPE.', checkedAt: '' },
    });
    let firstTabletRead = true;
    tablet.acquire.and.callFake(signal => {
      if (firstTabletRead) { firstTabletRead = false; return Promise.resolve(uid); }
      return waitingForAbort(signal);
    });
    tablet.report.and.resolveTo();
    tablet.publishCollector.and.resolveTo();
    const component = new FeesNfcControlComponent(bridge, members, fees, toast, tablet);
    component.source = 'pc';
    component.game = game;
    return { component, bridge, members, fees, game, gamer, member, toast, tablet };
  }

  it('waits for an in-flight NFC check-in before completing a mode change', fakeAsync(() => {
    const { component, fees } = setup();
    let finish!: (value: boolean) => void;
    fees.checkInByNfc.and.returnValue(new Promise<boolean>(resolve => finish = resolve));
    void component.startSession();
    flushMicrotasks();
    expect(fees.checkInByNfc).toHaveBeenCalled();

    let stopped = false;
    void component.stopForModeChange().then(result => stopped = result);
    flushMicrotasks();
    expect(stopped).toBeFalse();
    finish(true);
    flushMicrotasks();
    expect(stopped).toBeTrue();
    expect(component.sessionPending).toBeFalse();
  }));

  it('keeps diagnostics and a read-only test available with euro priority', async () => {
    const { bridge, members, fees, game, toast, tablet } = setup();
    localStorage.removeItem('fees-nfc-source');
    Object.assign(fees, { sys_conf: { trace_mode: true } });
    await TestBed.configureTestingModule({
      imports: [FeesNfcControlComponent],
      providers: [
        { provide: MemberNfcCardService, useValue: bridge },
        { provide: MembersService, useValue: members },
        { provide: FeesCollectorService, useValue: fees },
        { provide: ToastService, useValue: toast },
        { provide: TabletNfcBridgeService, useValue: tablet },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(FeesNfcControlComponent);
    fixture.componentRef.setInput('game', game);
    fixture.componentRef.setInput('paymentPreference', 'euro');
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.nfc-reader-indicator')?.textContent).toContain('Non vérifié');
    expect(root.querySelector('.nfc-checkin-indicator')?.textContent).toContain('Arrêté');
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
    expect(panel.textContent).toContain('Détecté par Windows — disponibilité physique non vérifiée');
    expect(panel.textContent).toContain('priorité Euro');
    expect(panel.textContent).toContain('aucun pointage effectué');
    const readerButton = root.querySelector<HTMLButtonElement>('button.nfc-reader-indicator')!;
    expect(root.querySelectorAll('.nfc-reader-indicator').length).toBe(1);
    expect(readerButton.textContent).toContain('Détecté (Windows)');
    expect(readerButton.textContent).not.toContain('Éveil non vérifié');
    expect(readerButton.querySelector('.nfc-status-light.text-warning')).not.toBeNull();
    expect(readerButton.querySelector('.nfc-status-light.text-success')).toBeNull();
    expect(readerButton.getAttribute('aria-label')).toContain('disponibilité physique non vérifiée');
    expect(root.querySelector('.nfc-checkin-indicator')?.textContent).toContain('Arrêté');
    const activate = Array.from(panel.querySelectorAll('button')).find(button => button.textContent?.includes('Activer le pointage'));
    expect(activate?.disabled).toBeTrue();
    expect(bridge.get).not.toHaveBeenCalled();
    expect(fees.checkInByNfc).not.toHaveBeenCalled();
    expect(toast.showSuccess).not.toHaveBeenCalled();
    expect(toast.showWarning).not.toHaveBeenCalled();
    fixture.destroy();
  });

  for (const [accepted, alreadyCheckedIn] of [[true, false], [true, true], [false, false]] as const) {
    it(`separates reader status from pointage and resets feedback after three seconds (accepted: ${accepted}, already checked in: ${alreadyCheckedIn})`, fakeAsync(() => {
      const { component, bridge, fees, gamer } = setup();
      gamer.validated = alreadyCheckedIn;
      let resolveUid!: (value: string) => void;
      let resolveCheckIn!: (value: boolean) => void;
      bridge.acquire.and.callFake(signal => {
        if (bridge.acquire.calls.count() === 1) {
          return new Promise<string>(resolve => { resolveUid = resolve; });
        }
        return waitingForAbort(signal);
      });
      fees.checkInByNfc.and.returnValue(new Promise<boolean>(resolve => { resolveCheckIn = resolve; }));

      void component.startSession();
      flushMicrotasks();
      const reader = component.reader;
      expect(component.checkInState).toBe('ready');
      expect(component.readerIndicatorColor).toBe('warning');

      resolveUid(uid);
      flushMicrotasks();
      expect(component.checkInState).toBe('checking');
      expect(component.reader).toBe(reader);

      resolveCheckIn(accepted);
      flushMicrotasks();
      expect(component.checkInState).toBe(accepted ? 'accepted' : 'refused');
      expect(component.checkInIndicatorMessage).toContain(accepted
        ? alreadyCheckedIn ? 'déjà pointé par carte' : 'pointage carte confirmé'
        : 'pointage refusé ou non confirmé');
      expect(component.highlightedPlayer?.gamer).toBe(accepted ? gamer : undefined);
      if (accepted) expect(component.highlightedPlayer?.alreadyCheckedIn).toBe(alreadyCheckedIn);
      expect(component.reader).toBe(reader);
      expect(component.readerIndicatorColor).toBe('warning');
      tick(2999);
      expect(component.checkInState).toBe(accepted ? 'accepted' : 'refused');
      tick(1);
      expect(component.checkInState).toBe('ready');
      expect(component.highlightedPlayer).toBeNull();
      expect(component.lastReading?.accepted).toBe(accepted);
      component.stopSession();
      flushMicrotasks();
      expect(component.checkInState).toBe('inactive');
      expect(component.checkInIndicatorLabel).toBe('Suspendu');
      expect(component.readerIndicatorColor).toBe('warning');
    }));
  }

  it('restarts the feedback duration when another card is read before the previous result expires', fakeAsync(() => {
    const { component, bridge } = setup();
    let resolveNextUid!: (value: string) => void;
    bridge.acquire.and.callFake(signal => {
      if (bridge.acquire.calls.count() === 1) return Promise.resolve(uid);
      if (bridge.acquire.calls.count() === 2) {
        return new Promise<string>(resolve => { resolveNextUid = resolve; });
      }
      return waitingForAbort(signal);
    });
    void component.startSession();
    flushMicrotasks();
    expect(component.checkInState).toBe('accepted');
    const firstHighlight = component.highlightedPlayer;
    tick(2000);
    resolveNextUid(uid);
    flushMicrotasks();
    expect(component.highlightedPlayer).not.toBe(firstHighlight);
    tick(1000);
    expect(component.checkInState).toBe('accepted');
    tick(2000);
    expect(component.checkInState).toBe('ready');
    component.ngOnDestroy();
    flushMicrotasks();
    expect(component.checkInState).toBe('inactive');
  }));

  it('renders the confirmed player in a fixed, non-interactive overlay', fakeAsync(() => {
    const { bridge, members, fees, game, toast, tablet } = setup();
    TestBed.configureTestingModule({
      imports: [FeesNfcControlComponent],
      providers: [
        { provide: MemberNfcCardService, useValue: bridge },
        { provide: MembersService, useValue: members },
        { provide: FeesCollectorService, useValue: fees },
        { provide: ToastService, useValue: toast },
        { provide: TabletNfcBridgeService, useValue: tablet },
      ],
    });
    const fixture = TestBed.createComponent(FeesNfcControlComponent);
    const component = fixture.componentInstance;
    component.source = 'pc';
    component.game = game;
    const root: HTMLElement = fixture.nativeElement;
    root.style.position = 'absolute';
    root.style.top = '-10000px';
    root.style.overflow = 'hidden';
    fixture.detectChanges();
    void component.startSession();
    flushMicrotasks();
    fixture.detectChanges();
    const layer: HTMLElement = root.querySelector('.confirmation-layer')!;
    expect(layer.textContent).toContain('Pointage confirmé');
    expect(layer.textContent).toContain('Jean Exemple');
    expect(getComputedStyle(layer).position).toBe('fixed');
    expect(getComputedStyle(layer).pointerEvents).toBe('none');
    const confirmation = layer.querySelector<HTMLElement>('.confirmation')!;
    const bounds = confirmation.getBoundingClientRect();
    expect(bounds.width).toBeGreaterThan(200);
    expect(bounds.height).toBeGreaterThan(50);
    expect(bounds.top).toBeGreaterThanOrEqual(0);
    expect(bounds.bottom).toBeLessThanOrEqual(window.innerHeight);
    component.highlightedPlayer = { gamer: game.gamers[0], alreadyCheckedIn: true };
    fixture.detectChanges();
    expect(layer.textContent).toContain('Déjà pointé par carte');
    component.stopSession();
    flushMicrotasks();
    fixture.detectChanges();
    expect(layer.querySelector('.confirmation')).toBeNull();
    fixture.destroy();
  }));

  it('does not infer reader sleep or disconnection from a read test timeout', fakeAsync(() => {
    const { component, bridge, fees } = setup();
    void component.refreshStatus();
    flushMicrotasks();
    const reader = component.reader;
    bridge.acquire.and.rejectWith(new NfcCaptureTimeoutError('Aucune carte détectée'));
    void component.testRead();
    flushMicrotasks();
    expect(component.error).toBe('Aucune carte détectée');
    expect(component.reader).toBe(reader);
    expect(component.readerIndicatorColor).toBe('warning');
    expect(component.readerIndicatorMessage).toContain('disponibilité physique non vérifiée');
    expect(component.checkInState).toBe('inactive');
    expect(fees.checkInByNfc).not.toHaveBeenCalled();
  }));

  it('shows a real ACS response separately from the cached Windows state', fakeAsync(() => {
    const { component, bridge } = setup();
    bridge.status.and.resolveTo({
      version: '1.0', readerStatus: 'Ready', readerName: 'ACR1555U',
      message: 'Déclaré par Windows', capturing: false,
      hardwareProbe: {
        state: 'Responsive', pcdPiccStatus: 1,
        message: 'Le lecteur répond ; aucune carte.', checkedAt: '2026-11-16T08:00:00Z',
      },
    });

    void component.refreshStatus();
    flushMicrotasks();

    expect(component.readerIndicatorLabel).toBe('Prêt');
    expect(component.readerIndicatorColor).toBe('success');
    expect(component.readerIndicatorMessage).toContain('interrogation ponctuelle');
    expect(component.readerIndicatorMessage).toContain('ne maintient pas le lecteur éveillé');
  }));

  it('does not start pointage when the ACS probe cannot reach the reader', fakeAsync(() => {
    const { component, bridge, fees } = setup();
    bridge.status.and.resolveTo({
      version: '1.0', readerStatus: 'Ready', readerName: 'ACR1555U',
      message: 'Déclaré par Windows', capturing: false,
      hardwareProbe: {
        state: 'Unresponsive', pcdPiccStatus: null,
        message: 'PC/SC error 0x0000048F', checkedAt: '2026-11-16T08:00:00Z',
      },
    });

    void component.startSession();
    flushMicrotasks();

    expect(component.readerIndicatorLabel).toBe('Non joignable');
    expect(component.readerIndicatorColor).toBe('danger');
    expect(component.active).toBeFalse();
    expect(bridge.acquire).not.toHaveBeenCalled();
    expect(fees.checkInByNfc).not.toHaveBeenCalled();
  }));

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

  describe('with the ppTPE tablet as source', () => {
    it('announces the session to the tablet, points the card and returns the verdict', fakeAsync(() => {
      const { component, bridge, fees, tablet } = setup();
      component.source = 'tablet';
      void component.startSession();
      flushMicrotasks();
      expect(bridge.status).not.toHaveBeenCalled();
      expect(tablet.watch).toHaveBeenCalledOnceWith('tablet-1');
      expect(tablet.publishCollector).toHaveBeenCalledWith('tablet-1', 'active', 'Tournoi test');
      expect(fees.checkInByNfc).toHaveBeenCalledOnceWith('00000001', jasmine.any(AbortSignal));
      expect(tablet.report).toHaveBeenCalledOnceWith(true, 'Jean Exemple : pointage carte confirmé.');
      tick(15_000);
      expect(tablet.publishCollector).toHaveBeenCalledTimes(2);
      component.stopSession();
      flushMicrotasks();
      expect(tablet.unwatch).toHaveBeenCalled();
      expect(tablet.publishCollector).toHaveBeenCalledWith('tablet-1', 'paused', 'Tournoi test', 'Pointage NFC suspendu.');
      tick(15_000);
      expect(tablet.publishCollector).toHaveBeenCalledTimes(3);
    }));

    it('returns a refusal to the tablet for an unknown card', fakeAsync(() => {
      const { component, bridge, fees, tablet } = setup();
      component.source = 'tablet';
      bridge.get.and.resolveTo(null);
      void component.startSession();
      flushMicrotasks();
      expect(fees.checkInByNfc).not.toHaveBeenCalled();
      expect(tablet.report).toHaveBeenCalledOnceWith(false, 'Carte inconnue.');
      component.stopSession();
      flushMicrotasks();
    }));

    it('stops pointage when the tablet reader is no longer ready after an idle wait', fakeAsync(() => {
      const { component, tablet } = setup();
      component.source = 'tablet';
      const ready = {
        version: 'ppTPE', readerStatus: 'Ready' as const, readerName: 'ACR1555U-A1-001714 PICC', message: 'Lecteur prêt',
        capturing: false, sessionId: 'tablet-1',
        hardwareProbe: { state: 'Responsive' as const, pcdPiccStatus: 1, message: 'Lecteur connecté à la tablette ppTPE.', checkedAt: '' },
      };
      const lost = {
        ...ready, readerStatus: 'Disconnected' as const, readerName: null, message: 'ACR1555U introuvable',
        hardwareProbe: { state: 'Unresponsive' as const, pcdPiccStatus: null, message: 'ACR1555U introuvable', checkedAt: '' },
      };
      tablet.status.and.returnValues(Promise.resolve(ready), Promise.resolve(lost));
      tablet.acquire.and.rejectWith(new NfcCaptureTimeoutError('Aucune carte présentée sur la tablette.'));
      void component.startSession();
      flushMicrotasks();
      expect(tablet.status).toHaveBeenCalledTimes(2);
      expect(component.active).toBeFalse();
      expect(component.error).toContain('ACR1555U introuvable');
      expect(tablet.publishCollector).toHaveBeenCalledWith(
        'tablet-1', 'stopped', 'Tournoi test', 'Pointage NFC arrêté : ACR1555U introuvable');
      component.stopSession();
    }));

    it('resumes on the same tablet after reader reconnection', fakeAsync(() => {
      const { component, tablet } = setup();
      component.source = 'tablet';
      const ready = {
        version: 'ppTPE', readerStatus: 'Ready' as const, readerName: 'ACR1555U', message: 'Prêt',
        capturing: false, sessionId: 'tablet-1',
        hardwareProbe: { state: 'Responsive' as const, pcdPiccStatus: 1, message: 'Prêt', checkedAt: '' },
      };
      const lost = {
        ...ready, readerStatus: 'Disconnected' as const,
        hardwareProbe: { ...ready.hardwareProbe, state: 'Unresponsive' as const, pcdPiccStatus: null, message: 'Déconnecté' },
      };
      tablet.status.and.returnValues(Promise.resolve(ready), Promise.resolve(lost), Promise.resolve(ready), Promise.resolve(ready));
      tablet.acquire.and.callFake(signal => tablet.acquire.calls.count() === 1
        ? Promise.reject(new NfcCaptureTimeoutError('Aucune carte'))
        : waitingForAbort(signal));
      void component.startSession();
      flushMicrotasks();
      expect(component.recovering).toBeTrue();
      expect(component.active).toBeFalse();
      tick(5000);
      flushMicrotasks();
      expect(tablet.status).toHaveBeenCalledWith(jasmine.any(AbortSignal), 'tablet-1');
      expect(component.recovering).toBeFalse();
      expect(component.active).toBeTrue();
      expect(tablet.watch).toHaveBeenCalledTimes(2);
      component.stopSession();
      flushMicrotasks();
    }));

    it('does not resume automatically after a manual suspension during recovery', fakeAsync(() => {
      const { component, tablet } = setup();
      component.source = 'tablet';
      tablet.status.and.rejectWith(new Error('Tablette indisponible'));
      void component.startSession();
      flushMicrotasks();
      expect(component.recovering).toBeTrue();
      component.stopSession();
      tick(10000);
      expect(tablet.status).toHaveBeenCalledTimes(1);
      expect(component.paused).toBeTrue();
      expect(component.active).toBeFalse();
    }));

    it('distinguishes an unregistered player from duplicate registrations', fakeAsync(() => {
      const { component, tablet, game, gamer } = setup();
      component.source = 'tablet';
      game.gamers = [];
      void component.startSession();
      flushMicrotasks();
      expect(tablet.report).toHaveBeenCalledWith(false, 'Le titulaire n’est pas inscrit à ce tournoi.');
      component.stopSession();
      flushMicrotasks();

      game.gamers = [gamer, { ...gamer }];
      tablet.acquire.and.callFake(signal => tablet.acquire.calls.count() === 3
        ? Promise.resolve(uid) : waitingForAbort(signal));
      void component.startSession();
      flushMicrotasks();
      expect(tablet.report).toHaveBeenCalledWith(false, 'Plusieurs inscriptions correspondent au titulaire : vérifiez la liste des joueurs.');
      component.stopSession();
      flushMicrotasks();
    }));

    it('retries the failed automatic activation when switching to the tablet', fakeAsync(() => {
      const { component, bridge, tablet } = setup();
      bridge.status.and.rejectWith(new Error('ppNFC indisponible'));
      component.ngOnChanges();
      flushMicrotasks();
      expect(component.sessionPending).toBeFalse();
      component.setSource('tablet');
      flushMicrotasks();
      expect(component.active).toBeTrue();
      expect(tablet.publishCollector).toHaveBeenCalledWith('tablet-1', 'active', 'Tournoi test');
      component.stopSession();
      flushMicrotasks();
    }));

    it('keeps the source unchanged while a session is running', fakeAsync(() => {
      const { component } = setup();
      component.source = 'tablet';
      void component.startSession();
      flushMicrotasks();
      component.setSource('pc');
      expect(component.source).toBe('tablet');
      component.stopSession();
      flushMicrotasks();
    }));
  });

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
      expect(component.checkInState).toBe('refused');
      expect(component.readerIndicatorColor).toBe('warning');
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
    expect(component.readerIndicatorColor).toBe('danger');
    expect(component.checkInState).toBe('inactive');
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
    expect(component.readerIndicatorLabel).toBe('Déconnecté');
    expect(component.readerIndicatorColor).toBe('danger');
    expect(component.checkInState).toBe('inactive');
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
