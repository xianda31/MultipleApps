import { TestBed } from '@angular/core/testing';
import { NfcMemberSummaryComponent } from './nfc-member-summary.component';
import { GroupService } from '../authentification/group.service';
import { NfcWorkspaceService } from '../services/nfc-workspace.service';

describe('Member NFC summary', () => {
  async function setup(level: number) {
    const nfc = jasmine.createSpyObj<NfcWorkspaceService>('NfcWorkspaceService', ['summary']);
    nfc.summary.and.resolveTo({ cards: [], request: {
      licenseNumber: '00123456', stage: 'ORDERED', orderReference: 'C-10', orderQuantity: 10,
      createdAt: '2026-11-14T10:00:00Z', updatedAt: '2026-11-14T10:00:00Z',
    } });
    await TestBed.configureTestingModule({
      imports: [NfcMemberSummaryComponent],
      providers: [
        { provide: NfcWorkspaceService, useValue: nfc },
        { provide: GroupService, useValue: { getUserAccreditation: async () => ({ level }) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(NfcMemberSummaryComponent);
    fixture.componentInstance.licenseNumber = '00123456';
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, nfc };
  }
  it('does not fetch NFC information for a non-administrator', async () => {
    const { fixture, nfc } = await setup(1);
    expect(nfc.summary).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });
  it('shows a read-only summary and emits the contextual navigation request', async () => {
    const { fixture, nfc } = await setup(3);
    const open = spyOn(fixture.componentInstance.open, 'emit');
    expect(nfc.summary).toHaveBeenCalledOnceWith('00123456');
    expect(fixture.nativeElement.textContent).toContain('Commandée');
    fixture.nativeElement.querySelector('button').click();
    expect(open).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelectorAll('button').length).toBe(1);
  });
});
