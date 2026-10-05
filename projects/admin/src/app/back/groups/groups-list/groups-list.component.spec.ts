import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GroupsListComponent } from './groups-list.component';

describe('GroupsListComponent', () => {
  let component: GroupsListComponent;
  let fixture: ComponentFixture<GroupsListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupsListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GroupsListComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('labels Cognito account statuses explicitly', () => {
    expect(component.accountStatusLabel({ UserStatus: 'CONFIRMED', Enabled: true } as any)).toBe('Confirmé');
    expect(component.accountStatusLabel({ UserStatus: 'UNCONFIRMED', Enabled: true } as any)).toBe('Confirmation en attente');
    expect(component.accountStatusLabel({ UserStatus: 'CONFIRMED', Enabled: false } as any)).toBe('Désactivé');
    expect(component.accountStatusLabel({ UserStatus: 'CONFIRMED', Enabled: true } as any, true)).toBe('Confirmé sans groupe');
  });

  it('sorts nominal users by email in both directions', () => {
    component.usersArray = [
      { Username: '2', Attributes: [{ Name: 'email' as any, Value: 'zoe@example.fr' }] },
      { Username: '1', Attributes: [{ Name: 'email' as any, Value: 'anna@example.fr' }] },
    ] as any;

    component.sortByEmail();
    expect(component.usersArray.map(user => component.userEmail(user))).toEqual([
      'anna@example.fr',
      'zoe@example.fr',
    ]);

    component.sortByEmail();
    expect(component.usersArray.map(user => component.userEmail(user))).toEqual([
      'zoe@example.fr',
      'anna@example.fr',
    ]);
  });

  it('restores the default group then name sort', () => {
    component.usersArray = [
      { Username: 'member', Attributes: [], member: { lastname: 'ALPHA', firstname: 'Anne' }, highest_group: 'Membre' },
      { Username: 'admin-z', Attributes: [], member: { lastname: 'ZULU', firstname: 'Zoé' }, highest_group: 'Administrateur' },
      { Username: 'admin-a', Attributes: [], member: { lastname: 'ALPHA', firstname: 'Alice' }, highest_group: 'Administrateur' },
    ] as any;

    component.sortByRightsAndName();

    expect(component.usersArray.map(user => user.Username)).toEqual(['admin-a', 'admin-z', 'member']);
    expect(component.emailSortDirection).toBeNull();
  });

  it('deletes a confirmed orphan account from the displayed lists', async () => {
    const orphan = {
      Username: 'orphan-1',
      Attributes: [{ Name: 'email' as any, Value: 'orphan@example.fr' }],
      member: null,
      highest_group: 'Membre',
      prev_group: 'Membre',
      Enabled: true,
    } as any;
    component.usersWithoutGroup = [orphan];
    component.usersArray = [orphan];
    component.openAccountsCount = 1;
    spyOn(window, 'confirm').and.returnValue(true);
    spyOn(component, '_deleteUser').and.resolveTo();

    await component.deleteOrphanAccount(orphan);

    expect(component._deleteUser).toHaveBeenCalledWith('orphan-1');
    expect(component.usersWithoutGroup).toEqual([]);
    expect(component.usersArray).toEqual([]);
    expect(component.openAccountsCount).toBe(0);
  });

  it('confirms an unconfirmed account and activates the Member group', async () => {
    const pending = {
      Username: 'pending-1',
      Attributes: [{ Name: 'email' as any, Value: 'pending@example.fr' }],
      member: { lastname: 'DUPONT', firstname: 'Anne' },
      highest_group: null,
      prev_group: null,
      UserStatus: 'UNCONFIRMED',
      Enabled: true,
    } as any;
    component.usersWithoutGroup = [pending];
    spyOn(window, 'confirm').and.returnValue(true);
    spyOn(component, '_confirmUser').and.resolveTo();

    await component.confirmUnconfirmedAccount(pending);

    expect(component._confirmUser).toHaveBeenCalledWith('pending-1');
    expect(pending.UserStatus).toBe('CONFIRMED');
    expect(pending.highest_group).toBe('Membre');
    expect(component.usersWithoutGroup).toEqual([]);
    expect(component.usersArray).toContain(pending);
  });
});
