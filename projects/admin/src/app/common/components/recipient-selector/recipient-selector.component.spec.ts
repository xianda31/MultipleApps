import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Member } from '../../interfaces/member.interface';
import { MembersService } from '../../services/members.service';
import { RecipientSelectorComponent } from './recipient-selector.component';

describe('RecipientSelectorComponent', () => {
  const activeAdherent = {
    id: 'adherent',
    firstname: 'Alice',
    lastname: 'ADHERENTE',
    email: 'alice@example.fr',
    accept_mailing: true,
    lifecycleStatus: 'ACTIVE',
    membership_date: '2026-09-01',
  } as Member;
  const activeOverdue = {
    id: 'overdue',
    firstname: 'Olivier',
    lastname: 'RETARD',
    email: 'olivier@example.fr',
    accept_mailing: true,
    lifecycleStatus: 'ACTIVE',
    membership_date: '',
  } as Member;
  const archivedAdherent = {
    ...activeAdherent,
    id: 'archived',
    lifecycleStatus: 'ARCHIVED',
  } as Member;

  let component: RecipientSelectorComponent;

  beforeEach(() => {
    const membersService = jasmine.createSpyObj(
      'MembersService',
      ['listMembers', 'isActive', 'isMembershipRenewalOverdue', 'hasPaidMembership', 'full_name'],
    );
    membersService.listMembers.and.returnValue(of([activeAdherent, activeOverdue, archivedAdherent]));
    membersService.isActive.and.callFake((member: Member) => member.lifecycleStatus === 'ACTIVE');
    membersService.hasPaidMembership.and.callFake((member: Member) => !!member.membership_date);
    membersService.isMembershipRenewalOverdue.and.callFake(
      (member: Member) => member.lifecycleStatus === 'ACTIVE' && !member.membership_date,
    );

    TestBed.configureTestingModule({
      imports: [RecipientSelectorComponent],
      providers: [{ provide: MembersService, useValue: membersService }],
    });
    const fixture = TestBed.createComponent(RecipientSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('keeps unselected active members visible for the overdue preset', () => {
    component.applyPreset('OVERDUE');

    expect(component.members.map((member) => member.id)).toEqual(['adherent', 'overdue']);
    expect(component.filteredMembers.map((member) => member.id)).toEqual(['adherent', 'overdue']);
    expect(component.selectedCount).toBe(1);
    expect(component.isSelected('overdue')).toBeTrue();
    expect(component.isSelected('adherent')).toBeFalse();

    component.showSelectedOnly = true;
    expect(component.filteredMembers.map((member) => member.id)).toEqual(['overdue']);
  });

  it('selects active paid members for the adherents preset', () => {
    component.applyPreset('ADHERENTS');

    expect(component.selectedCount).toBe(1);
    expect(component.isSelected('adherent')).toBeTrue();
    expect(component.isSelected('overdue')).toBeFalse();
    expect(component.isSelected('archived')).toBeFalse();
  });

  it('selects all active members for the active preset', () => {
    component.applyPreset('ACTIVE');

    expect(component.selectedCount).toBe(2);
    expect(component.allSelected).toBeTrue();
  });
});
