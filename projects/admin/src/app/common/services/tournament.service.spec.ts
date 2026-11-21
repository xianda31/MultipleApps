import { FFB_proxyService } from '../ffb/services/ffb.service';
import { ToastService } from './toast.service';
import { TournamentService } from './tournament.service';
import { SystemDataService } from './system-data.service';
import { SystemConfiguration } from '../interfaces/system-conf.interface';
import { Tournament } from '../ffb/interface/tournament.interface';
import { BehaviorSubject, firstValueFrom, of, Subject } from 'rxjs';

describe('TournamentService team registration', () => {
    let service: TournamentService;
    let ffbService: jasmine.SpyObj<FFB_proxyService>;
    let toastService: jasmine.SpyObj<ToastService>;

    beforeEach(() => {
        ffbService = jasmine.createSpyObj<FFB_proxyService>('FFB_proxyService', ['postTeam']);
        toastService = jasmine.createSpyObj<ToastService>('ToastService', ['showError']);
        service = new TournamentService(ffbService, toastService, jasmine.createSpyObj('SystemDataService', ['get_configuration']));
    });

    describe('TournamentService club cache', () => {
        let service: TournamentService;
        let ffb: jasmine.SpyObj<FFB_proxyService>;
        let toast: jasmine.SpyObj<ToastService>;
        let configuration: BehaviorSubject<SystemConfiguration>;
        const from = new Date('2026-11-01T12:00:00');
        const to = new Date('2026-12-01T12:00:00');
        const saintOrens: Tournament[] = [{ id: 1, title: 'Saint-Orens', date: '2026-11-21', entryCount: 0 }];
        const otherClub: Tournament[] = [{ id: 2, title: 'Autre club', date: '2026-11-21', entryCount: 0 }];

        beforeEach(() => {
            configuration = new BehaviorSubject<SystemConfiguration>({
                club_identifier: 'club', trace_mode: false, club_bank_key: '',
                ffb_club_code: '5500020', ffb_organization_id: '1403',
                online_payment_active: false, tpe_payment_active: false, CB_fees_account: '', minimum_cb_amount: 0,
                fee_rates: [], revenue_and_expense_tree: { sections: [], revenues: [], expenses: [] },
                profit_and_loss: { debit_key: '', credit_key: '' }, banks: [],
            });
            const systemData = jasmine.createSpyObj<SystemDataService>('SystemDataService', ['get_configuration', 'getFfbClubIdentity']);
            systemData.get_configuration.and.returnValue(configuration.asObservable());
            systemData.getFfbClubIdentity.and.callFake(() => ({
                code: configuration.value.ffb_club_code!,
                organizationId: configuration.value.ffb_organization_id!,
            }));
            ffb = jasmine.createSpyObj<FFB_proxyService>('FFB_proxyService', ['_getTournaments', 'checkAlive']);
            toast = jasmine.createSpyObj<ToastService>('ToastService', ['showError']);
            service = new TournamentService(ffb, toast, systemData);
        });

        it('reuses the cache for the same club and dates, but not after changing club', async () => {
            ffb._getTournaments.and.returnValues(of(saintOrens), of(otherClub));
            expect(await firstValueFrom(service.list_tournaments(from, to))).toEqual(saintOrens);
            expect(await firstValueFrom(service.list_tournaments(from, to))).toEqual(saintOrens);
            expect(ffb._getTournaments).toHaveBeenCalledTimes(1);

            configuration.next({ ...configuration.value, ffb_club_code: '5500058', ffb_organization_id: '1441' });
            expect(await firstValueFrom(service.list_tournaments(from, to))).toEqual(otherClub);
            expect(await firstValueFrom(service.list_tournaments(from, to))).toEqual(otherClub);
            expect(ffb._getTournaments).toHaveBeenCalledTimes(2);
        });

        it('does not cache or display a response received after the club changes', async () => {
            const pending = new Subject<Tournament[]>();
            ffb._getTournaments.and.returnValues(pending, of(otherClub));
            spyOn(console, 'warn');
            const oldRequest = firstValueFrom(service.list_tournaments(from, to));
            configuration.next({ ...configuration.value, ffb_club_code: '5500058', ffb_organization_id: '1441' });
            pending.next(saintOrens);
            pending.complete();
            expect(await oldRequest).toEqual([]);
            expect(toast.showError).toHaveBeenCalledWith('Club FFB modifié', 'Rechargez les tournois pour le club sélectionné.');
            expect(await firstValueFrom(service.list_tournaments(from, to))).toEqual(otherClub);
        });
    });

    it('propagates the original FFB error to the registration component', async () => {
        const error = new Error('Les inscriptions sont gérées par l’entité organisatrice.');
        ffbService.postTeam.and.rejectWith(error);
        spyOn(console, 'error');

        await expectAsync(service.createTeam('516676', [83243, 259431])).toBeRejectedWith(error);
        expect(ffbService.postTeam).toHaveBeenCalledOnceWith('516676', [83243, 259431]);
        expect(toastService.showError).not.toHaveBeenCalled();
        expect(console.error).not.toHaveBeenCalled();
    });

    it('preserves successful and refused registration results', async () => {
        ffbService.postTeam.and.resolveTo(true);
        await expectAsync(service.createTeam('123', [1, 2])).toBeResolvedTo(true);
        ffbService.postTeam.and.resolveTo(false);
        await expectAsync(service.createTeam('123', [1, 2])).toBeResolvedTo(false);
    });

    it('rejects duplicate players before sending a request', async () => {
        await expectAsync(service.createTeam('123', [1, 1])).toBeResolvedTo(false);
        expect(ffbService.postTeam).not.toHaveBeenCalled();
        expect(toastService.showError).toHaveBeenCalledWith(
            'Création d\'équipe', 'Les deux joueurs doivent être différents',
        );
    });
});
