import { Game_status } from '../fees.interface';
import { FeesCollectorService } from './fees-collector.service';

describe('FeesCollectorService settlement protection', () => {
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
});
