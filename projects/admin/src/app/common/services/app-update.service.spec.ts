import { Subject } from 'rxjs';

import { AppUpdateService, shouldRecoverFromBrokenCache } from './app-update.service';

describe('AppUpdateService', () => {
  it('requests cache recovery when a version installation fails with a hash mismatch', () => {
    const versionUpdates = new Subject<any>();
    const service = new AppUpdateService({ versionUpdates, unrecoverable: new Subject() } as any);
    const recovery = spyOn<any>(service, 'recoverFromBrokenCache').and.resolveTo();

    versionUpdates.next({
      type: 'VERSION_INSTALLATION_FAILED',
      version: { hash: 'new-version' },
      error: 'Hash mismatch for /main.js',
    });

    expect(recovery).toHaveBeenCalledOnceWith('Hash mismatch for /main.js');
  });

  it('only permits one recovery attempt for a broken cache', () => {
    expect(shouldRecoverFromBrokenCache('Hash mismatch for /main.js', false)).toBeTrue();
    expect(shouldRecoverFromBrokenCache('unrecoverable application state', false)).toBeTrue();
    expect(shouldRecoverFromBrokenCache('Hash mismatch for /main.js', true)).toBeFalse();
    expect(shouldRecoverFromBrokenCache('Network timeout', false)).toBeFalse();
  });
});