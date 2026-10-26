import { GetConfirmationComponent } from '../../../common/modals/get-confirmation.component';
import { Game_status } from '../fees.interface';
import { FeesCollectorComponent } from './fees-collector.component';

describe('FeesCollectorComponent restored tournament', () => {
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
