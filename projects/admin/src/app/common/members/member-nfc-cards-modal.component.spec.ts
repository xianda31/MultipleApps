import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Member } from '../interfaces/member.interface';
import { MemberNfcCard, MemberNfcCardService } from '../services/member-nfc-card.service';
import { ToastService } from '../services/toast.service';
import { MemberNfcCardsModalComponent } from './member-nfc-cards-modal.component';

describe('MemberNfcCardsModalComponent', () => {
  const member: Member = {
    id: 'member-1', firstname: 'Alex', lastname: 'EXAMPLE', gender: 'U',
    license_number: '00123456', lifecycleStatus: 'ACTIVE',
    birthdate: '', city: '', email: '', phone_one: '', license_taken_at: '',
    license_status: '', membership_date: '', accept_mailing: false,
  };
  const card: MemberNfcCard = {
    uid: '04E50142E37384', licenseNumber: member.license_number, status: 'ACTIVE',
    assignedAt: '2026-11-11T10:00:00Z', assignedBy: 'operator',
    createdAt: '2026-11-11T10:00:00Z', updatedAt: '2026-11-11T10:00:00Z',
  };
  let nfc: jasmine.SpyObj<MemberNfcCardService>;
  let modal: jasmine.SpyObj<NgbActiveModal>;
  let toast: jasmine.SpyObj<ToastService>;
  let component: MemberNfcCardsModalComponent;
  let fixture: ComponentFixture<MemberNfcCardsModalComponent>;

  beforeEach(async () => {
    nfc = jasmine.createSpyObj('MemberNfcCardService', ['list', 'acquire', 'get', 'assign', 'deactivate']);
    nfc.list.and.resolveTo([]);
    nfc.acquire.and.resolveTo(card.uid);
    nfc.get.and.resolveTo(null);
    nfc.assign.and.resolveTo(card);
    nfc.deactivate.and.resolveTo({ ...card, status: 'DISABLED' });
    modal = jasmine.createSpyObj('NgbActiveModal', ['close']);
    toast = jasmine.createSpyObj('ToastService', ['showSuccess']);
    TestBed.configureTestingModule({
      imports: [MemberNfcCardsModalComponent],
      providers: [
        { provide: MemberNfcCardService, useValue: nfc },
        { provide: NgbActiveModal, useValue: modal },
        { provide: ToastService, useValue: toast },
      ],
    });
    fixture = TestBed.createComponent(MemberNfcCardsModalComponent);
    component = fixture.componentInstance;
    component.member = member;
    component.members = [member];
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('wires the visible acquisition and confirmation buttons without a ppNFC window', async () => {
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    root.querySelector<HTMLButtonElement>('.btn-primary')?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.textContent).toContain(card.uid);
    expect(nfc.assign).not.toHaveBeenCalled();
    spyOn(window, 'confirm').and.returnValue(true);
    root.querySelector<HTMLButtonElement>('.btn-success')?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(nfc.assign).toHaveBeenCalledOnceWith(card.uid, member, null);
    expect(root.querySelector('tbody')?.textContent).toContain('Active');
  });

  it('reads a UID without saving and waits for explicit confirmation', async () => {
    await component.acquire();
    expect(component.scannedUid).toBe(card.uid);
    expect(nfc.assign).not.toHaveBeenCalled();
    spyOn(window, 'confirm').and.returnValue(true);
    await component.assign();
    expect(nfc.assign).toHaveBeenCalledOnceWith(card.uid, member, null);
    expect(component.cards).toEqual([card]);
    expect(toast.showSuccess).toHaveBeenCalled();
    expect(component.scannedUid).toBe('');
  });

  it('does not save when confirmation is declined', async () => {
    await component.acquire();
    spyOn(window, 'confirm').and.returnValue(false);
    await component.assign();
    expect(nfc.assign).not.toHaveBeenCalled();
  });

  it('prevents silently stealing an active card and explicitly transfers disabled cards', async () => {
    const other = { ...card, licenseNumber: '87654321' };
    nfc.get.and.resolveTo(other);
    await component.acquire();
    expect(component.transferBlocked).toBeTrue();
    await component.assign();
    expect(nfc.assign).not.toHaveBeenCalled();
    const disabled = { ...other, status: 'DISABLED' as const };
    nfc.get.and.resolveTo(disabled);
    await component.acquire();
    expect(component.transferBlocked).toBeFalse();
    const confirm = spyOn(window, 'confirm').and.returnValue(true);
    await component.assign();
    expect(confirm).toHaveBeenCalledWith(jasmine.stringContaining('Réattribuer'));
    expect(nfc.assign).toHaveBeenCalledOnceWith(card.uid, member, disabled);
  });

  it('deactivates rather than deleting and allows explicit reactivation', async () => {
    component.cards = [card];
    spyOn(window, 'confirm').and.returnValue(true);
    await component.deactivate(card);
    expect(nfc.deactivate).toHaveBeenCalledOnceWith(card);
    expect(component.cards[0].status).toBe('DISABLED');
    const disabled = component.cards[0];
    await component.reactivate(disabled);
    expect(nfc.assign).toHaveBeenCalledOnceWith(card.uid, member, disabled);
    expect(component.cards[0].status).toBe('ACTIVE');
  });

  it('cancels a pending acquisition on closing and ignores a late result', async () => {
    let finish!: (uid: string) => void;
    nfc.acquire.and.returnValue(new Promise(resolve => { finish = resolve; }));
    const pending = component.acquire();
    const signal = nfc.acquire.calls.mostRecent().args[0];
    component.close();
    expect(signal.aborted).toBeTrue();
    expect(modal.close).toHaveBeenCalled();
    finish(card.uid);
    await pending;
    expect(component.scannedUid).toBe('');
    expect(nfc.get).not.toHaveBeenCalled();
  });

  it('reports a failed lookup without enabling attribution', async () => {
    spyOn(console, 'error');
    nfc.get.and.rejectWith(new Error('Lookup denied'));
    await component.acquire();
    expect(component.scannedUid).toBe('');
    expect(component.error).toBe('Lookup denied');
    await component.assign();
    expect(nfc.assign).not.toHaveBeenCalled();
  });

  it('requires a reload after a concurrent-write failure instead of retrying a stale association', async () => {
    spyOn(console, 'error');
    spyOn(window, 'confirm').and.returnValue(true);
    await component.acquire();
    nfc.assign.and.rejectWith(new Error('Conflict'));
    await component.assign();
    expect(component.error).toBe('Conflict');
    expect(component.loaded).toBeFalse();
    expect(component.scannedUid).toBe('');
    expect(toast.showSuccess).not.toHaveBeenCalled();
  });

  it('blocks acquisition and reactivation for inactive members but allows deactivation', async () => {
    component.member = { ...member, lifecycleStatus: 'BANNED' };
    await component.acquire();
    await component.reactivate({ ...card, status: 'DISABLED' });
    expect(nfc.acquire).not.toHaveBeenCalled();
    expect(nfc.assign).not.toHaveBeenCalled();
    spyOn(window, 'confirm').and.returnValue(true);
    await component.deactivate(card);
    expect(nfc.deactivate).toHaveBeenCalled();
  });
});
