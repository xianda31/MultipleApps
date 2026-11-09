import { firstValueFrom } from 'rxjs';
import { ClubMember } from '../ffb/interface/club-member.interface';
import { LicenseesService } from './licensees.service';

describe('LicenseesService', () => {
  it('shares the cached list until an explicit refresh replaces it', async () => {
    const ffbService = jasmine.createSpyObj('FFBProxyService', ['getAdherents']);
    const initial: ClubMember[] = [];
    ffbService.getAdherents.and.resolveTo(initial);
    const service = new LicenseesService(ffbService);

    expect(await firstValueFrom(service.getClubMembers$())).toBe(initial);
    expect(await firstValueFrom(service.getClubMembers$())).toBe(initial);
    expect(ffbService.getAdherents).toHaveBeenCalledTimes(1);

    const refreshed: ClubMember[] = [];
    ffbService.getAdherents.and.resolveTo(refreshed);
    expect(await firstValueFrom(service.getClubMembers$(true))).toBe(refreshed);
    expect(await firstValueFrom(service.getClubMembers$())).toBe(refreshed);
    expect(ffbService.getAdherents).toHaveBeenCalledTimes(2);
  });
});
