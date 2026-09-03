import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { FFB_proxyService } from '../ffb/services/ffb.service';

export type FfbAvailabilityStatus = 'checking' | 'available' | 'maintenance' | 'unavailable';

export interface FfbAvailabilitySnapshot {
  status: FfbAvailabilityStatus;
  checkedAt: Date | null;
  upstreamStatus?: number;
}

@Injectable({ providedIn: 'root' })
export class FfbAvailabilityService {
  private readonly snapshotSubject = new BehaviorSubject<FfbAvailabilitySnapshot>({
    status: 'checking',
    checkedAt: null,
  });
  private refreshInFlight: Promise<FfbAvailabilitySnapshot> | null = null;
  private monitoringStarted = false;
  private readonly refreshIntervalMs = 5 * 60 * 1000;

  readonly snapshot$ = this.snapshotSubject.asObservable();

  constructor(private ffbService: FFB_proxyService) {}

  startMonitoring(): void {
    if (this.monitoringStarted) return;
    this.monitoringStarted = true;

    void this.refresh();
    setInterval(() => void this.refresh(), this.refreshIntervalMs);
    window.addEventListener('online', () => void this.refresh());
  }

  refresh(): Promise<FfbAvailabilitySnapshot> {
    if (this.refreshInFlight) return this.refreshInFlight;

    this.snapshotSubject.next({
      ...this.snapshotSubject.value,
      status: 'checking',
    });

    this.refreshInFlight = this.ffbService.checkAlive()
      .then((health) => {
        const snapshot: FfbAvailabilitySnapshot = {
          status: health.maintenance
            ? 'maintenance'
            : health.alive
              ? 'available'
              : 'unavailable',
          checkedAt: new Date(),
          upstreamStatus: health.upstreamStatus,
        };
        this.snapshotSubject.next(snapshot);
        return snapshot;
      })
      .finally(() => {
        this.refreshInFlight = null;
      });

    return this.refreshInFlight;
  }
}