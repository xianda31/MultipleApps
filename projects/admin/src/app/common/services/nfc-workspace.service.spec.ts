import { NfcWorkspaceService } from './nfc-workspace.service';
import type { ImportBatch, NfcSnapshot, NfcChange } from '../../../../../common/nfc-contract';
import { changeCard } from '../../back/nfc/nfc-domain';

describe('NFC import persistence', () => {
  const now = '2026-11-14T10:00:00.000Z';
  const row = { uid: '04E50142E37384', licenseNumber: '00123456', firstname: 'Alex', lastname: 'Exemple' };
  const snapshot: NfcSnapshot = {
    members: [{ id: 'one', license_number: row.licenseNumber, firstname: row.firstname, lastname: row.lastname, lifecycleStatus: 'ACTIVE' }],
    cards: [], requests: [], batches: [],
  };
  const batch: ImportBatch = {
    id: '2d9a979e-2ca7-44a4-bb84-ce9d69967c5e', filename: 'cards.csv', actor: 'operator',
    rows: [{ ...row, line: 2, outcome: 'CREATE', message: 'Nouvelle attribution' }],
    results: [], cursor: 0, createdAt: now, updatedAt: now,
  };

  it('commits a new attribution and its batch progress together', async () => {
    const service = new NfcWorkspaceService();
    const commit = spyOn(service, 'commit').and.callFake(async (_action, changes) => changes);
    const saved = await service.importNext(batch, snapshot);
    expect(saved.cursor).toBe(1);
    const changes = commit.calls.mostRecent().args[1];
    expect(changes.map(change => change.entity)).toEqual(['card', 'batch']);
    expect(changes[0].expectedVersion).toBeNull();
    expect(changes[1].expectedVersion).toBe(now);
    expect(batch.cursor).toBe(0);
  });

  it('skips identical associations under a version check and records incompatible rows as errors', async () => {
    const service = new NfcWorkspaceService();
    const commit = spyOn(service, 'commit').and.callFake(async (_action, changes) => changes);
    const card = changeCard('ASSIGN', row.uid, undefined, row.licenseNumber, snapshot.members, 'operator', now);
    const saved = await service.importNext(batch, { ...snapshot, cards: [card] });
    expect(saved.results[0].outcome).toBe('SKIP');
    expect(commit.calls.mostRecent().args[2]).toEqual([{ uid: card.uid, updatedAt: card.updatedAt }]);
    const failed = await service.importNext(batch, { ...snapshot, cards: [{ ...card, status: 'DISABLED' }] });
    expect(failed.results[0].outcome).toBe('ERROR');
    expect(commit.calls.mostRecent().args[1].map(change => change.entity)).toEqual(['batch']);
  });

  it('does not advance the local cursor when an atomic write fails', async () => {
    const service = new NfcWorkspaceService();
    spyOn(service, 'commit').and.rejectWith(new Error('Concurrent update'));
    await expectAsync(service.importNext(batch, snapshot)).toBeRejectedWithError('Concurrent update');
    expect(batch.cursor).toBe(0);
    expect(batch.results).toEqual([]);
  });

  it('revalidates the complete file before creating a persistent batch', async () => {
    const service = new NfcWorkspaceService();
    spyOn(service, 'snapshot').and.resolveTo(snapshot);
    const commit = spyOn(service, 'commit');
    await expectAsync(service.createBatch('cards.csv', [row, row], 2)).toBeRejectedWithError(/anomalies/);
    expect(commit).not.toHaveBeenCalled();
  });

  it('propagates backend errors instead of returning a success-shaped result', async () => {
    const service = new NfcWorkspaceService();
    Object.defineProperty(service, 'client', { get: () => ({
      mutations: { manageNfc: async () => ({ errors: [{ message: 'Conflict' }] }) },
    }) });
    await expectAsync(service.commit('IMPORT_START', [] as NfcChange[])).toBeRejectedWithError('Conflict');
  });
});
