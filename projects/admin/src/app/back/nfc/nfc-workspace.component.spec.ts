import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { NfcWorkspaceComponent } from './nfc-workspace.component';
import { NfcWorkspaceService } from '../../common/services/nfc-workspace.service';
import { MemberNfcCardService } from '../../common/services/member-nfc-card.service';
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
    const bridge = jasmine.createSpyObj<MemberNfcCardService>('MemberNfcCardService', ['acquire', 'status']);
    bridge.acquire.and.resolveTo(snapshot.cards[0].uid);
    await TestBed.configureTestingModule({
      imports: [NfcWorkspaceComponent],
      providers: [
        { provide: NfcWorkspaceService, useValue: service },
        { provide: MemberNfcCardService, useValue: bridge },
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({ license: '00123456' })) } },
        { provide: MembersService, useValue: {} },
        { provide: MemberSettingsService, useValue: {} },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(NfcWorkspaceComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, service, bridge };
  }

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

  it('separates station availability from reader availability and keeps tests read-only', async () => {
    const { fixture, bridge, service } = await setup();
    bridge.status.and.resolveTo({
      version: '1.0', readerStatus: 'Disconnected', readerName: null, message: 'Absent', capturing: false,
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
