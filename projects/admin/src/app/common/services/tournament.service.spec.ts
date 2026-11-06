import { FFB_proxyService } from '../ffb/services/ffb.service';
import { ToastService } from './toast.service';
import { TournamentService } from './tournament.service';

describe('TournamentService team registration', () => {
    let service: TournamentService;
    let ffbService: jasmine.SpyObj<FFB_proxyService>;
    let toastService: jasmine.SpyObj<ToastService>;

    beforeEach(() => {
        ffbService = jasmine.createSpyObj<FFB_proxyService>('FFB_proxyService', ['postTeam']);
        toastService = jasmine.createSpyObj<ToastService>('ToastService', ['showError']);
        service = new TournamentService(ffbService, toastService);
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
