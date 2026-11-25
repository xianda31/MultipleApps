import { GetConfirmationComponent } from '../../../common/modals/get-confirmation.component';
import { Game_status } from '../fees.interface';
import { FeesCollectorComponent } from './fees-collector.component';

describe('FeesCollectorComponent restored tournament', () => {
  it('marks a tournament recovered after a saved player replacement and offers to resume it', async () => {
    const component = Object.create(FeesCollectorComponent.prototype) as FeesCollectorComponent;
    const tournament = { id: 1, date: '2026-11-25', title: 'Tournoi', entryCount: 2, status: Game_status.INITIAL };
    const fees = {
      playersLoading: false, rosterLocked: false,
      replacePlayer: jasmine.createSpy().and.resolveTo(false),
      clear_tournament: jasmine.createSpy(),
      set_tournament: jasmine.createSpy().and.resolveTo(),
    };
    const modal = { componentInstance: {}, result: pendingPromise<boolean>() };
    const modalService = jasmine.createSpyObj('NgbModal', ['open']);
    modalService.open.and.returnValue(modal);
    Object.assign(component, {
      GAME_STATUS: Game_status, selected_tournament: tournament, next_tournaments: [tournament],
      game: { tournament: { id: 1 }, gamers: [] },
      pairEditMode: 'replace', replacedPlayer: { license: '1' }, replacementPlayer: { id: 2 },
      editingRoster: 'roster', feesCollectorService: fees, modalService,
      operationalMode: 'classic', nfcCheckInEnabled: false, quickSaleSaving: false,
    });
    spyOn(component, 'showPairList');
    spyOn(component, 'cancelQuickSale');
    const key = 'fees-collector.operational-session';
    const previous = sessionStorage.getItem(key);
    try {
      await component.confirmPairChange();
      expect(tournament.status).toBe(Game_status.INITIAL);
      fees.replacePlayer.and.resolveTo(true);
      await component.confirmPairChange();
      expect(tournament.status).toBe(Game_status.RECOVERED);

      component.clear_session();
      await component.set_tournament(tournament);
      expect(modalService.open).toHaveBeenCalledOnceWith(GetConfirmationComponent, jasmine.any(Object));
      expect(modal.componentInstance).toEqual(jasmine.objectContaining({
        title: 'Pointage existant', cancelLabel: 'Reprendre le pointage',
      }));
    } finally {
      if (previous === null) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, previous);
    }
  });

  for (const savedMode of ['nfc-one', 'nfc-two', 'nfc']) {
    it(`restores ${savedMode} as NFC for the same tournament`, async () => {
      const key = 'fees-collector.operational-session';
      const previous = sessionStorage.getItem(key);
      sessionStorage.setItem(key, JSON.stringify({ tournamentId: '338133', mode: savedMode }));
      try {
        const component = Object.create(FeesCollectorComponent.prototype) as FeesCollectorComponent;
        const tournament = { id: 338133, date: '2026-11-11', title: 'Tournoi', entryCount: 0, status: Game_status.INITIAL };
        Object.assign(component, {
          GAME_STATUS: Game_status, operationalMode: 'classic', nfcCheckInEnabled: true,
          feesCollectorService: { set_tournament: async () => {} },
        });
        await component.set_tournament(tournament);
        expect(component.operationalMode).toBe('nfc');
        expect(component.protectCollectorExit).toBeTrue();
      } finally {
        if (previous === null) sessionStorage.removeItem(key);
        else sessionStorage.setItem(key, previous);
      }
    });
  }

  it('closes the restore choice without offering settlement when no gamer was saved', async () => {
    const component = Object.create(FeesCollectorComponent.prototype) as FeesCollectorComponent;
    const tournament = {
      id: 338132,
      date: '2026-11-11',
      title: 'Tournoi ouvert par erreur',
      entryCount: 0,
      status: Game_status.RECOVERED,
    };
    const restoreModal = {
      componentInstance: {},
      result: Promise.resolve(false),
    };
    const modalService = jasmine.createSpyObj('NgbModal', ['open']);
    modalService.open.and.returnValue(restoreModal);
    const feesCollectorService = jasmine.createSpyObj('FeesCollectorService', ['set_tournament']);
    feesCollectorService.set_tournament.and.callFake(async () => {
      Object.assign(component as object, {
        game: {
          tournament: { id: tournament.id },
          gamers: [],
        },
      });
    });
    Object.assign(component as object, {
      GAME_STATUS: Game_status,
      feesCollectorService,
      modalService,
      toastService: jasmine.createSpyObj('ToastService', ['showInfo', 'showSuccess']),
      next_tournaments: [tournament],
    });

    await component.set_tournament(tournament);
    await restoreModal.result;
    await Promise.resolve();

    expect(modalService.open).toHaveBeenCalledTimes(1);
    expect(component.all_gamers_validated()).toBeFalse();
  });

  it('offers settlement after resuming a fully checked-in tournament', async () => {
    const component = Object.create(FeesCollectorComponent.prototype) as FeesCollectorComponent;
    const tournament = {
      id: 338131,
      date: '2026-11-06',
      title: 'Tournoi',
      entryCount: 4,
      status: Game_status.RECOVERED,
    };
    const restoreModal = {
      componentInstance: {},
      result: Promise.resolve(false),
    };
    const settlementModal = {
      componentInstance: {},
      result: pendingPromise<boolean>(),
    };
    const modalService = jasmine.createSpyObj('NgbModal', ['open']);
    modalService.open.and.returnValues(restoreModal, settlementModal);
    const feesCollectorService = jasmine.createSpyObj('FeesCollectorService', ['set_tournament']);
    feesCollectorService.set_tournament.and.callFake(async () => {
      Object.assign(component as object, {
        game: {
          tournament: { id: tournament.id },
          gamers: [
            { validated: true },
            { validated: true },
            { validated: true },
            { validated: true },
          ],
        },
      });
    });
    const toastService = jasmine.createSpyObj('ToastService', ['showInfo', 'showSuccess']);
    Object.assign(component as object, {
      GAME_STATUS: Game_status,
      feesCollectorService,
      modalService,
      toastService,
      next_tournaments: [tournament],
    });

    await component.set_tournament(tournament);
    await restoreModal.result;
    await Promise.resolve();

    expect(feesCollectorService.set_tournament).toHaveBeenCalledOnceWith(tournament);
    expect(modalService.open).toHaveBeenCalledTimes(2);
    expect(modalService.open.calls.argsFor(0)[0]).toBe(GetConfirmationComponent);
    expect(restoreModal.componentInstance).toEqual(jasmine.objectContaining({
      title: 'Pointage existant',
      subtitle: 'Un pointage a été retrouvé pour ce tournoi.',
    }));
    expect(settlementModal.componentInstance).toEqual(jasmine.objectContaining({
      title: 'Tous les joueurs sont pointés',
      confirmLabel: 'Valider les droits',
    }));
  });
});

function pendingPromise<T>(): Promise<T> {
  return new Promise<T>(() => undefined);
}
