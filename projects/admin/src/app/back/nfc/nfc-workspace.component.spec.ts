import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { NfcWorkspaceComponent } from './nfc-workspace.component';
import { NfcWorkspaceService } from '../../common/services/nfc-workspace.service';
import { TabletNfcBridgeService } from '../../common/services/tablet-nfc-bridge.service';
import { MembersService } from '../../common/services/members.service';
import { MemberSettingsService } from '../../common/services/member-settings.service';
import type { NfcSnapshot } from '../../../../../common/nfc-contract';

describe('NFC workspace', () => {
  const snapshot: NfcSnapshot = {
    members: [{ id: 'one', firstname: 'Alex', lastname: 'Exemple', license_number: '00123456', lifecycleStatus: 'ACTIVE' }],
    cards: [{
      uid: '04E50142E37384', licenseNumber: '00123456', kind: 'WHITE', stockState: 'ASSIGNED',
      status: 'ACTIVE', createdAt: '2026-11-14T10:00:00Z', updatedAt: '2026-11-14T10:00:00Z',
    }],
    requests: [], batches: [],
  };
  async function setup() {
    const service = jasmine.createSpyObj<NfcWorkspaceService>('NfcWorkspaceService', ['snapshot', 'history', 'card', 'commit']);
    service.snapshot.and.resolveTo(snapshot);
    service.history.and.resolveTo([]);
    const tablet = jasmine.createSpyObj<TabletNfcBridgeService>('TabletNfcBridgeService', ['readOnce', 'status']);
    tablet.readOnce.and.resolveTo(snapshot.cards[0].uid);
    await TestBed.configureTestingModule({
      imports: [NfcWorkspaceComponent],
      providers: [
        { provide: NfcWorkspaceService, useValue: service },
        { provide: TabletNfcBridgeService, useValue: tablet },
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({ license: '00123456' })) } },
        { provide: MembersService, useValue: {} },
        { provide: MemberSettingsService, useValue: {} },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(NfcWorkspaceComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, service, tablet };
  }

  it('uses the ppTPE tablet even when the previous preference was PC', async () => {
    localStorage.setItem('fees-nfc-source', 'pc');
    const { fixture, tablet, service } = await setup();
    await fixture.componentInstance.readCard();
    fixture.detectChanges();
    expect(tablet.readOnce).toHaveBeenCalledOnceWith(jasmine.any(AbortSignal), jasmine.any(String), jasmine.any(String));
    expect(fixture.nativeElement.textContent).toContain('Alex Exemple');
    expect(service.commit).not.toHaveBeenCalled();
    localStorage.removeItem('fees-nfc-source');
  });

  it('identifies a presented card without opening a member or modifying its attribution', async () => {
    const { fixture, service } = await setup();
    await fixture.componentInstance.readCard();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.textContent).toContain('Alex Exemple');
    expect(root.textContent).toContain('Blanche — Active');
    expect(root.textContent).toContain('aucun pointage ni changement');
    expect(service.card).not.toHaveBeenCalled();
    expect(service.commit).not.toHaveBeenCalled();
    expect(fixture.componentInstance.query).toBe('00123456');
  });

  it('does not treat unavailable data as an unknown card or write after a declined confirmation', async () => {
    const { fixture, service } = await setup();
    spyOn(window, 'confirm').and.returnValue(false);
    fixture.componentInstance.selectedUid = snapshot.cards[0].uid;
    await fixture.componentInstance.cardAction('RETURN');
    expect(service.card).not.toHaveBeenCalled();
    service.snapshot.and.rejectWith(new Error('Backend absent'));
    await fixture.componentInstance.readCard();
    fixture.detectChanges();
    expect(fixture.componentInstance.identified).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('Backend absent');
  });

  it('lists active card recipients surname first, sorted by surname then first name', async () => {
    const { fixture, service } = await setup();
    service.snapshot.and.resolveTo({
      ...snapshot,
      members: [
        { id: 'one', firstname: 'Alice', lastname: 'Zola', license_number: '00123456', lifecycleStatus: 'ACTIVE' },
        { id: 'two', firstname: 'Zoé', lastname: 'Évrard', license_number: '00123457', lifecycleStatus: 'ACTIVE' },
        { id: 'three', firstname: 'Bruno', lastname: 'Évrard', license_number: '00123458', lifecycleStatus: 'ACTIVE' },
      ],
    });
    await fixture.componentInstance.readCard();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const options = Array.from(root.querySelectorAll<HTMLOptionElement>('#nfc-owner option')).slice(1);
    expect(options.map(option => option.text)).toEqual([
      'Évrard Bruno — 00123458',
      'Évrard Zoé — 00123457',
      'Zola Alice — 00123456',
    ]);
  });

  it('separates station availability from reader availability and keeps tests read-only', async () => {
    const { fixture, tablet, service } = await setup();
    tablet.status.and.resolveTo({
      version: 'ppTPE', readerStatus: 'Disconnected', readerName: null, message: 'Absent', capturing: false, sessionId: 'tablet-1',
    });
    fixture.componentInstance.tab = 'Poste de lecture';
    await fixture.componentInstance.checkBridge();
    await fixture.componentInstance.readCard();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.textContent).toContain('Joignable');
    expect(root.textContent).toContain('Disconnected');
    expect(root.textContent).not.toContain('Confirmer le prêt');
    expect(root.textContent).not.toContain('Restituer et remettre');
    expect(service.card).not.toHaveBeenCalled();
  });
});
