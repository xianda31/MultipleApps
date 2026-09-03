import { firstValueFrom, take } from 'rxjs';
import { FfbAvailabilityService } from './ffb-availability.service';

describe('FfbAvailabilityService', () => {
  it('exposes FFB maintenance globally', async () => {
    const ffbService = jasmine.createSpyObj('FFBProxyService', ['checkAlive']);
    ffbService.checkAlive.and.resolveTo({ alive: false, maintenance: true, upstreamStatus: 503 });
    const service = new FfbAvailabilityService(ffbService);

    await service.refresh();
    const snapshot = await firstValueFrom(service.snapshot$.pipe(take(1)));

    expect(snapshot).toEqual(jasmine.objectContaining({
      status: 'maintenance',
      upstreamStatus: 503,
    }));
  });

  it('reports an unavailable upstream without treating it as available', async () => {
    const ffbService = jasmine.createSpyObj('FFBProxyService', ['checkAlive']);
    ffbService.checkAlive.and.resolveTo({ alive: false, maintenance: false });
    const service = new FfbAvailabilityService(ffbService);

    const snapshot = await service.refresh();

    expect(snapshot.status).toBe('unavailable');
  });
});