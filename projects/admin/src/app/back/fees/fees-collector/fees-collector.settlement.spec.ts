import { Game_status } from '../fees.interface';
import { FeesCollectorService } from './fees-collector.service';

describe('FeesCollectorService settlement protection', () => {
  function pendingPromise<T>(): Promise<T> {
    return new Promise<T>(() => undefined);
  }

  it('refuses to reset a tournament after settlement has started', async () => {
    const service = Object.create(FeesCollectorService.prototype) as FeesCollectorService;
    const dbHandler = jasmine.createSpyObj('DBhandler', [
      'create_custom_key',
      'readGameSettlementStatus',
      'deleteGameCheckIns',
      'deleteGameFeeConfiguration',
      'deleteGame',
    ]);
    dbHandler.create_custom_key.and.returnValue('2026/2027_338131');
    dbHandler.readGameSettlementStatus.and.resolveTo('failed');
    const toastService = jasmine.createSpyObj('ToastService', ['showError']);
    Object.assign(service as object, {
      DBhandler: dbHandler,
      systemDataService: {
        get_season: () => '2026/2027',
      },
      toastService,
    });

    const reset = await service.reset_tournament_state({
      id: 338131,
      date: '2026-10-16',
      title: 'Tournoi',
      entryCount: 56,
      status: Game_status.RECOVERED,
    });

    expect(reset).toBeFalse();
    expect(toastService.showError).toHaveBeenCalledWith(
      'Remise à zéro impossible',
      'Une clôture a déjà commencé et peut avoir débité des cartes. Une intervention est requise.',
    );
    expect(dbHandler.deleteGameCheckIns).not.toHaveBeenCalled();
    expect(dbHandler.deleteGameFeeConfiguration).not.toHaveBeenCalled();
    expect(dbHandler.deleteGame).not.toHaveBeenCalled();
  });

  it('resets a recovered tournament when settlement never started', async () => {
    const service = Object.create(FeesCollectorService.prototype) as FeesCollectorService;
    const dbHandler = jasmine.createSpyObj('DBhandler', [
      'create_custom_key',
      'readGameSettlementStatus',
      'deleteGameCheckIns',
      'deleteGameFeeConfiguration',
      'deleteGame',
    ]);
    dbHandler.create_custom_key.and.returnValue('2026/2027_338131');
    dbHandler.readGameSettlementStatus.and.resolveTo(null);
    dbHandler.deleteGameCheckIns.and.resolveTo();
    dbHandler.deleteGameFeeConfiguration.and.resolveTo();
    dbHandler.deleteGame.and.resolveTo(true);
    Object.assign(service as object, {
      DBhandler: dbHandler,
      systemDataService: {
        get_season: () => '2026/2027',
      },
      toastService: jasmine.createSpyObj('ToastService', ['showError']),
    });
    spyOn<any>(service, 'stopCheckInSync');
    spyOn<any>(service, 'stopFeeConfigurationSync');
    spyOn(service, 'set_game');

    const tournament = {
      id: 338131,
      date: '2026-10-16',
      title: 'Tournoi',
      entryCount: 56,
      status: Game_status.RECOVERED,
    };
    const reset = await service.reset_tournament_state(tournament);

    expect(reset).toBeTrue();
    expect(dbHandler.deleteGameCheckIns).toHaveBeenCalledOnceWith('2026/2027_338131');
    expect(dbHandler.deleteGameFeeConfiguration).toHaveBeenCalledOnceWith('2026/2027_338131');
    expect(dbHandler.deleteGame).toHaveBeenCalledOnceWith('2026/2027', 338131);
    expect(service.set_game).toHaveBeenCalledOnceWith(tournament);
  });

  it('stops when the shared preflight times out without acquiring a lock', async () => {
    const service = Object.create(FeesCollectorService.prototype) as FeesCollectorService;
    const dbHandler = jasmine.createSpyObj('DBhandler', [
      'create_custom_key',
      'readGameFeeConfiguration',
      'listGameCheckIns',
      'acquireGameSettlement',
    ]);
    dbHandler.create_custom_key.and.returnValue('2026/2027_338131');
    dbHandler.readGameFeeConfiguration.and.returnValue(pendingPromise());
    const toastService = jasmine.createSpyObj('ToastService', ['showError', 'showWarning']);
    Object.assign(service as object, {
      DBhandler: dbHandler,
      toastService,
      settlementPreflightTimeoutMs: 1,
      settlementInProgress: false,
      game: {
        season: '2026/2027',
        tournament: { id: 338131 },
        gamers: [],
      },
    });

    const saved = await service.save_fees();

    expect(saved).toBeFalse();
    expect(dbHandler.listGameCheckIns).not.toHaveBeenCalled();
    expect(dbHandler.acquireGameSettlement).not.toHaveBeenCalled();
    expect(toastService.showError).toHaveBeenCalledWith(
      'Clôture impossible',
      'Les données partagées n’ont pas pu être vérifiées. Aucune carte n’a été débitée.',
    );
  });

  it('prevents two simultaneous settlements on the same instance', async () => {
    const service = Object.create(FeesCollectorService.prototype) as FeesCollectorService;
    const toastService = jasmine.createSpyObj('ToastService', ['showError', 'showWarning']);
    Object.assign(service as object, {
      toastService,
      settlementInProgress: true,
    });

    const saved = await service.save_fees();

    expect(saved).toBeFalse();
    expect(toastService.showWarning).toHaveBeenCalledWith(
      'droits de table',
      'La clôture est déjà en cours sur cet appareil.',
    );
  });

  it('releases a newly acquired lock when the final preflight fails', async () => {
    const service = Object.create(FeesCollectorService.prototype) as FeesCollectorService;
    const dbHandler = jasmine.createSpyObj('DBhandler', [
      'create_custom_key',
      'acquireGameSettlement',
      'deleteGameSettlement',
      'failGameSettlement',
    ]);
    dbHandler.create_custom_key.and.returnValue('2026/2027_338131');
    dbHandler.acquireGameSettlement.and.resolveTo('acquired');
    dbHandler.deleteGameSettlement.and.resolveTo();
    const gameCardService = jasmine.createSpyObj('GameCardService', ['stamp_member_card']);
    const bookService = jasmine.createSpyObj('BookService', ['create_tournament_fees_entry']);
    const toastService = jasmine.createSpyObj('ToastService', ['showError', 'showWarning']);
    Object.assign(service as object, {
      DBhandler: dbHandler,
      gameCardService,
      BookService: bookService,
      toastService,
      settlementInProgress: false,
      members: [],
      game: {
        season: '2026/2027',
        tournament: { id: 338131 },
        gamers: [],
      },
    });
    spyOn<any>(service, 'currentSettlementOwner').and.resolveTo('operator');
    spyOn<any>(service, 'runSettlementPreflight').and.returnValues(
      Promise.resolve(),
      Promise.reject(new Error('Network unavailable')),
    );

    const saved = await service.save_fees();

    expect(saved).toBeFalse();
    expect(dbHandler.acquireGameSettlement).toHaveBeenCalledOnceWith('2026/2027_338131', 'operator');
    expect(dbHandler.deleteGameSettlement).toHaveBeenCalledOnceWith('2026/2027_338131');
    expect(dbHandler.failGameSettlement).not.toHaveBeenCalled();
    expect(gameCardService.stamp_member_card).not.toHaveBeenCalled();
    expect(bookService.create_tournament_fees_entry).not.toHaveBeenCalled();
    expect(toastService.showError).toHaveBeenCalledWith(
      'Clôture impossible',
      'Les données partagées n’ont pas pu être vérifiées. Aucune carte n’a été débitée.',
    );
  });
});
