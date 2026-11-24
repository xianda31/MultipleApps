import { fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { NfcRelayService, reconnectNfcSubscription } from '../../../../../pptpe/src/app/nfc/nfc-relay.service';
import { NfcCaptureTimeoutError } from './member-nfc-card.service';
import { TabletNfcBridgeService } from './tablet-nfc-bridge.service';

describe('NFC relay reconnection', () => {
  it('resubscribes after an error and stops retrying after unsubscribe', fakeAsync(() => {
    const subjects: Subject<string>[] = [];
    const values: string[] = [];
    spyOn(console, 'warn');
    const subscription = reconnectNfcSubscription(() => {
      const subject = new Subject<string>();
      subjects.push(subject);
      return subject;
    }, 'test').subscribe(value => values.push(value));

    subjects[0].error(new Error('offline'));
    tick(5000);
    subjects[1].next('reconnected');
    expect(values).toEqual(['reconnected']);
    subjects[1].error(new Error('offline again'));
    subscription.unsubscribe();
    tick(5000);
    expect(subjects.length).toBe(2);
  }));

  it('resubscribes when a subscription completes unexpectedly', fakeAsync(() => {
    let attempts = 0;
    const subscription = reconnectNfcSubscription(() => new Observable<void>(observer => {
      attempts++;
      observer.complete();
    }), 'test').subscribe();
    tick(5000);
    expect(attempts).toBe(2);
    subscription.unsubscribe();
  }));

  it('does not replace a newer notification with an older synchronization response', async () => {
    const relay = Object.create(NfcRelayService.prototype) as NfcRelayService;
    let resolve!: (value: object) => void;
    const get = jasmine.createSpy().and.returnValue(new Promise(res => resolve = res));
    const client = { models: { NfcReaderSession: { get } } };
    const apply = jasmine.createSpy('applyCollector');
    Object.assign(relay, {
      sessionId: 'session', client, collectorRevision: 1,
      zone: { run: (fn: () => void) => fn() }, applyCollector: apply,
    });
    const pending = relay['syncCollector']();
    Object.assign(relay, { collectorRevision: 2 });
    resolve({ data: { collectorStatus: 'stopped' } });
    await pending;
    expect(apply).not.toHaveBeenCalled();
  });

  it('checks the chosen tablet instead of switching to another session', async () => {
    const bridge = new TabletNfcBridgeService();
    const get = jasmine.createSpy().and.resolveTo({ data: {
      id: 'tablet-1', status: 'ready', readerUpdatedAt: Math.floor(Date.now() / 1000),
    } });
    const list = jasmine.createSpy();
    Object.defineProperty(bridge, 'client', { value: { models: { NfcReaderSession: { get, list } } } });
    const status = await bridge.status(new AbortController().signal, 'tablet-1');
    expect(status.sessionId).toBe('tablet-1');
    expect(get).toHaveBeenCalledOnceWith({ id: 'tablet-1' });
    expect(list).not.toHaveBeenCalled();
  });

  it('ends a tablet read promptly when the scan subscription fails', fakeAsync(() => {
    const bridge = new TabletNfcBridgeService();
    const scans = new Subject<{ uid: string; id: string }>();
    Object.defineProperty(bridge, 'client', { value: { models: { NfcScan: { onCreate: () => scans } } } });
    spyOn(console, 'error');
    bridge.watch('tablet-1');
    let failure: unknown;
    void bridge.acquire(new AbortController().signal).catch(error => failure = error);
    scans.error(new Error('offline'));
    flushMicrotasks();
    expect(failure instanceof Error && failure.message).toContain('interrompue');
    bridge.unwatch();
  }));

  it('allows the collector to check tablet status after a short idle read', fakeAsync(() => {
    const bridge = new TabletNfcBridgeService();
    const scans = new Subject<{ uid: string; id: string }>();
    Object.defineProperty(bridge, 'client', { value: { models: { NfcScan: { onCreate: () => scans } } } });
    bridge.watch('tablet-1');
    let failure: unknown;
    void bridge.acquire(new AbortController().signal, 5000).catch(error => failure = error);
    tick(5000);
    expect(failure).toEqual(jasmine.any(NfcCaptureTimeoutError));
    bridge.unwatch();
  }));
});
