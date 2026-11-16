import { BehaviorSubject } from 'rxjs';
import { FEE_RATE, Game, Gamer, GameCheckIn, GameFeeConfiguration } from '../fees.interface';
import { FeesCollectorService } from './fees-collector.service';
import { FeesCollectorComponent } from './fees-collector.component';

describe('shared check-in cancellation', () => {
  const stamp = '2026-11-15T08:00:00.000Z';
  function setup() {
    const gamer: Gamer = {
      license: '00000001', firstname: 'A', lastname: 'B', is_member: true, game_credits: 2,
      debt: 0, credit: 0, index: 0, in_euro: false, price: 3, validated: true, enabled: true,
      photo_url$: null, member_id: '1', my_birthday: null, check_in_updated_at: stamp, check_in_source: 'manual',
    };
    const game: Game = {
      season: '2026', fee_rate: FEE_RATE.STANDARD, member_trn_price: 3, non_member_trn_price: 5,
      fees_doubled: false, alphabetic_sort: false,
      tournament: { id: 1, name: 'Test', date: '2026-11-15', time: '14:00' }, gamers: [gamer],
    };
    const current: GameCheckIn = {
      gameId: '2026_1', license: gamer.license, mode: 'card', source: 'manual', updatedBy: 'operator', updatedAt: stamp,
    };
    const db = jasmine.createSpyObj('DBhandler', ['create_custom_key', 'readGameSettlementStatus', 'readGameCheckIn', 'listGameCheckIns', 'upsertGameCheckIn']);
    db.create_custom_key.and.returnValue('2026_1');
    db.readGameSettlementStatus.and.resolveTo(null);
    db.readGameCheckIn.and.resolveTo(current);
    db.upsertGameCheckIn.and.callFake(async (input: GameCheckIn) => ({ ...input, updatedAt: '2026-11-15T08:01:00.000Z' }));
    const toast = jasmine.createSpyObj('ToastService', ['showWarning', 'showInfo', 'showError']);
    const service = Object.create(FeesCollectorService.prototype) as FeesCollectorService;
    service.game = game;
    service._game$ = new BehaviorSubject(game);
    Object.assign(service, {
      DBhandler: db, toastService: toast, tournament: { id: 1 },
      sys_conf: {
        fee_rates: [
          { key: FEE_RATE.STANDARD, member_price: 3, non_member_price: 5, payment_preference: 'card' },
        ],
      },
    });
    spyOn(service, 'log_game_state').and.resolveTo();
    return { service, gamer, db, toast, current };
  }

  for (const alphabeticSort of [false, true]) {
    it(`keeps checked-in slots until explicitly regrouped (alphabetic: ${alphabeticSort})`, () => {
      const { gamer, service } = setup();
      const component = Object.create(FeesCollectorComponent.prototype) as FeesCollectorComponent;
      Object.assign(component, {
        game: { ...service.game, alphabetic_sort: alphabeticSort },
        hideValidated: true,
        visibleGamerLicenses: new Set<string>(),
        feesCollectorService: { set_hide_validated: (hidden: boolean) => hidden },
      });
      expect(component.shouldShowGamer(gamer)).toBeFalse();
      gamer.validated = false;
      component.setValidatedFilter(true);
      expect(component.shouldShowGamer(gamer)).toBeTrue();
      gamer.validated = true;
      expect(component.shouldShowGamer(gamer)).toBeTrue();
      component.setValidatedFilter(true);
      expect(component.shouldShowGamer(gamer)).toBeFalse();
      gamer.validated = false;
      expect(component.shouldShowGamer(gamer)).toBeTrue();
      gamer.validated = true;
      component.hideValidated = false;
      expect(component.shouldShowGamer(gamer)).toBeTrue();
    });
  }

  it('stores a versioned unpointed state, separate from offered, and allows a new NFC check-in', async () => {
    const { service, gamer, db, current } = setup();
    expect(await service.cancelGamerCheckIn(gamer)).toBeTrue();
    expect(db.upsertGameCheckIn).toHaveBeenCalledWith(jasmine.objectContaining({ mode: 'unpointed', source: 'manual' }), stamp);
    expect(gamer.validated).toBeFalse();
    expect(gamer.enabled).toBeTrue();
    const cancelled = { ...current, mode: 'unpointed', updatedAt: gamer.check_in_updated_at };
    db.readGameCheckIn.and.resolveTo(cancelled);
    expect(await service.checkInByNfc(gamer.license)).toBeTrue();
    expect(gamer.validated).toBeTrue();
    expect(db.upsertGameCheckIn.calls.mostRecent().args[0].source).toBe('nfc');
  });

  for (const entryPoint of ['hook', 'payment']) {
    it(`refuses NFC check-in with euro priority through the ${entryPoint} entry point`, async () => {
      const { service, gamer, db, toast } = setup();
      service.sys_conf.fee_rates[0].payment_preference = 'euro';
      gamer.validated = false;
      const previousState = { ...gamer };

      const result = entryPoint === 'hook'
        ? await service.checkInByNfc(gamer.license)
        : await service.setGamerPayment(gamer, 'card', 'nfc');

      expect(result).toBeFalse();
      expect(gamer).toEqual(previousState);
      expect(db.readGameSettlementStatus).not.toHaveBeenCalled();
      expect(db.upsertGameCheckIn).not.toHaveBeenCalled();
      expect(toast.showWarning).toHaveBeenCalledOnceWith(
        'Pointage NFC',
        'Le pointage NFC est réservé aux tournois à priorité de règlement par carte.',
      );
    });
  }

  it('still allows manual card check-in with euro priority', async () => {
    const { service, gamer, db } = setup();
    service.sys_conf.fee_rates[0].payment_preference = 'euro';
    gamer.validated = false;

    expect(await service.setGamerPayment(gamer, 'card', 'manual')).toBeTrue();
    expect(db.upsertGameCheckIn).toHaveBeenCalledWith(
      jasmine.objectContaining({ mode: 'card', source: 'manual' }), stamp,
    );
  });

  it('refuses stale manual edits and adopts the other post’s state', async () => {
    const { service, gamer, db, current, toast } = setup();
    db.readGameCheckIn.and.resolveTo({ ...current, mode: 'euro', updatedAt: '2026-11-15T08:02:00.000Z' });
    expect(await service.cancelGamerCheckIn(gamer)).toBeFalse();
    expect(db.upsertGameCheckIn).not.toHaveBeenCalled();
    expect(gamer.in_euro).toBeTrue();
    expect(toast.showWarning).toHaveBeenCalled();
  });

  it('does not change local state on write failure or while closing', async () => {
    const { service, gamer, db, toast } = setup();
    db.upsertGameCheckIn.and.rejectWith(new Error('Conflict'));
    expect(await service.cancelGamerCheckIn(gamer)).toBeFalse();
    expect(gamer.validated).toBeTrue();
    expect(toast.showError).toHaveBeenCalled();
    db.readGameSettlementStatus.and.resolveTo({ status: 'closing' });
    expect(await service.cancelGamerCheckIn(gamer)).toBeFalse();
    expect(db.upsertGameCheckIn).toHaveBeenCalledTimes(1);
  });

  it('restores a cancellation on refresh and ignores an older update', async () => {
    const { service, gamer, db, current } = setup();
    const cancelled = { ...current, mode: 'unpointed', updatedAt: '2026-11-15T08:02:00.000Z' };
    db.listGameCheckIns.and.resolveTo([cancelled]);
    await service.refreshGameCheckIns();
    expect(gamer.validated).toBeFalse();
    db.listGameCheckIns.and.resolveTo([current]);
    await service.refreshGameCheckIns();
    expect(gamer.validated).toBeFalse();
    expect(gamer.check_in_updated_at).toBe(cancelled.updatedAt);
  });

  it('requires sufficient credits and does not select euro as a fallback', async () => {
    const { service, gamer, db } = setup();
    gamer.validated = false;
    gamer.game_credits = 1;
    service.game.fees_doubled = true;
    expect(await service.setGamerPayment(gamer, 'card')).toBeFalse();
    expect(db.upsertGameCheckIn).not.toHaveBeenCalled();
    expect(gamer.in_euro).toBeFalse();
    gamer.game_credits = 2;
    expect(await service.setGamerPayment(gamer, 'card')).toBeTrue();
    expect(db.upsertGameCheckIn).toHaveBeenCalledWith(jasmine.objectContaining({ mode: 'card' }), stamp);
  });

  it('uses the system fee-rate preference instead of the legacy tournament preference, without changing check-ins', async () => {
    const { service, gamer, db } = setup();
    Object.assign(service, {
      sys_conf: {
        fee_rates: [
          { key: FEE_RATE.STANDARD, member_price: 3, non_member_price: 5 },
          { key: FEE_RATE.HOLIDAYS, member_price: 3, non_member_price: 5, payment_preference: 'euro' },
        ],
      },
    });
    const configuration: GameFeeConfiguration = {
      gameId: '2026_1', feeRate: FEE_RATE.STANDARD, memberPrice: 3,
      nonMemberPrice: 5, feesDoubled: false, paymentPreference: 'euro', updatedBy: 'operator',
    };
    const readConfiguration = jasmine.createSpy().and.resolveTo(configuration);
    Object.assign(db, { readGameFeeConfiguration: readConfiguration });
    await service.refreshFeeConfiguration();
    expect(service.paymentPreference).toBe('card');
    expect(gamer.validated).toBeTrue();
    expect(gamer.in_euro).toBeFalse();
    expect(db.upsertGameCheckIn).not.toHaveBeenCalled();
    readConfiguration.and.resolveTo({ ...configuration, feeRate: FEE_RATE.HOLIDAYS, paymentPreference: 'card' });
    await service.refreshFeeConfiguration();
    expect(service.paymentPreference).toBe('euro');
    expect(gamer.in_euro).toBeFalse();
  });

  it('warns about a preference change with existing check-ins even when prices do not change', async () => {
    const { service, gamer, db } = setup();
    Object.assign(service, {
      sys_conf: {
        fee_rates: [
          { key: FEE_RATE.STANDARD, member_price: 3, non_member_price: 5, payment_preference: 'card' },
          { key: FEE_RATE.HOLIDAYS, member_price: 3, non_member_price: 5, payment_preference: 'euro' },
        ],
      },
    });
    const configuration: GameFeeConfiguration = {
      gameId: '2026_1', feeRate: FEE_RATE.STANDARD, memberPrice: 3,
      nonMemberPrice: 5, feesDoubled: false, updatedBy: 'operator',
    };
    Object.assign(db, {
      readGameFeeConfiguration: jasmine.createSpy().and.resolveTo(configuration),
      updateGameFeeConfiguration: jasmine.createSpy().and.callFake(async (input: Partial<GameFeeConfiguration>) => ({
        ...configuration, ...input,
      })),
    });
    const alert = spyOn(window, 'alert');
    expect(await service.changeFeeMode('summer')).toBeTrue();
    expect(alert).toHaveBeenCalledOnceWith(jasmine.stringContaining('Règlement préféré modifié'));
    expect(service.paymentPreference).toBe('euro');
    expect(gamer.validated).toBeTrue();
    expect(gamer.in_euro).toBeFalse();
  });

  it('does not reopen the completion dialog when a player is unpointed', async () => {
    const { gamer } = setup();
    const component = Object.create(FeesCollectorComponent.prototype) as FeesCollectorComponent;
    Object.assign(component, {
      pendingCheckIns: new Set<string>(),
      feesCollectorService: { cancelGamerCheckIn: jasmine.createSpy().and.resolveTo(true) },
    });
    const checkStatus = spyOn(component, 'check_status');
    await component.cancelCheckIn(gamer);
    expect(checkStatus).not.toHaveBeenCalled();
  });

  it('keeps offered and unpointed distinct in the visual label', () => {
    const { gamer } = setup();
    const component = Object.create(FeesCollectorComponent.prototype) as FeesCollectorComponent;
    gamer.validated = true;
    gamer.enabled = true;
    gamer.in_euro = false;
    expect(component.checkInLabel(gamer)).toBe('Carte');
    gamer.in_euro = true;
    expect(component.checkInLabel(gamer)).toBe('3 €');
    gamer.price = 3.5;
    expect(component.checkInLabel(gamer)).toBe('3,5 €');
    gamer.enabled = false;
    expect(component.checkInLabel(gamer)).toBe('Offert');
    gamer.validated = false;
    expect(component.checkInLabel(gamer)).toBe('Pointer');
    expect(component.gamer_class(gamer)).not.toContain('is-checked-in');
    gamer.validated = true;
    expect(component.gamer_class(gamer)).toContain('is-checked-in');
  });

  it('counts all checked-in players independently of their payment mode', () => {
    const { gamer } = setup();
    const component = Object.create(FeesCollectorComponent.prototype) as FeesCollectorComponent;
    component.game = { gamers: [
      gamer,
      { ...gamer, validated: true, enabled: false },
      { ...gamer, validated: false },
    ] } as Game;
    expect(component.checkedInCount).toBe(2);
  });
});
