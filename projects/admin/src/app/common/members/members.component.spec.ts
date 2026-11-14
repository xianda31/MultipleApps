import { fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { MembersComponent } from './members.component';
import { Member } from '../interfaces/member.interface';
import { MembersService } from '../services/members.service';
import { MemberSyncService } from '../services/member-sync.service';
import { MemberSettingsService } from '../services/member-settings.service';
import { SystemDataService } from '../services/system-data.service';
import { ToastService } from '../services/toast.service';
import { FFB_proxyService } from '../ffb/services/ffb.service';
import { AuthentificationService } from '../authentification/authentification.service';
import { GroupService } from '../authentification/group.service';

describe('MembersComponent progressive synchronization', () => {
  const member: Member = {
    id: 'member-1', firstname: 'Alex', lastname: 'EXAMPLE', gender: 'U',
    license_number: '01234567', birthdate: '', city: '', email: 'alex@example.fr',
    phone_one: '', license_taken_at: '', license_status: 'unregistered',
    membership_date: '2026-09-01', accept_mailing: false, lifecycleStatus: 'ACTIVE',
  };

  function setup() {
    let complete!: (members: Member[]) => void;
    let fail!: (error: Error) => void;
    const synchronization = new Promise<Member[]>((resolve, reject) => {
      complete = resolve;
      fail = reject;
    });
    const snapshots = new BehaviorSubject<Member[] | null>(null);
    const toast = jasmine.createSpyObj('ToastService', ['showError']);
    const modals = jasmine.createSpyObj('NgbModal', ['open']);
    modals.open.and.returnValue({ componentInstance: {} });
    const configuration = {
      get_local_season: () => '2026/2027',
      date_in_season: () => true,
      get_configuration: () => of({ season: '2026/2027' }),
    };
    TestBed.configureTestingModule({
      imports: [MembersComponent],
      providers: [
        { provide: MembersService, useFactory: () => new MembersService(
          TestBed.inject(ToastService),
          jasmine.createSpyObj('DBhandler', { listMembers: of([member]) }),
          TestBed.inject(SystemDataService),
        ) },
        { provide: MemberSyncService, useValue: {
          syncProgress$: of({ percent: 3, label: 'Chargement' }),
          syncMembers$: snapshots.asObservable(),
          ensureMembersSynchronized: () => synchronization,
          getPendingMergeConflicts: () => [],
        } },
        { provide: SystemDataService, useValue: configuration },
        { provide: MemberSettingsService, useValue: {
          settingsChange$: () => of({}), getAvatarUrl: () => of(''),
        } },
        { provide: ToastService, useValue: toast },
        { provide: FFB_proxyService, useValue: {} },
        { provide: AuthentificationService, useValue: {} },
        { provide: GroupService, useValue: { getUserAccreditation: () => Promise.resolve({ level: 0 }) } },
        { provide: NgbModal, useValue: modals },
      ],
    });
    const fixture = TestBed.createComponent(MembersComponent);
    fixture.detectChanges();
    flushMicrotasks();
    fixture.detectChanges();
    return { fixture, snapshots, complete, fail, toast, modals };
  }

  it('keeps the member settings entry without a duplicate NFC editor', fakeAsync(() => {
    const { fixture, complete } = setup();
    complete([member]);
    flushMicrotasks();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('[aria-label="Gérer les cartes NFC"]')).toBeNull();
    expect(root.querySelector('[aria-label="Voir la fiche"]')).not.toBeNull();
  }));

  it('keeps summary rows compact without shrinking member rows', fakeAsync(() => {
    const { fixture, complete } = setup();
    const root: HTMLElement = fixture.nativeElement;
    const summaryRows = root.querySelectorAll<HTMLTableRowElement>('.members-stats-table tbody tr');
    expect(summaryRows.length).toBeGreaterThan(0);
    summaryRows.forEach(row => {
      expect(row.getBoundingClientRect().height).toBeGreaterThan(0);
      expect(row.getBoundingClientRect().height).toBeLessThan(28);
    });
    const memberRow = root.querySelector<HTMLTableRowElement>('.members-table tbody tr');
    expect(memberRow?.getBoundingClientRect().height).toBeGreaterThanOrEqual(38);
    complete([member]);
    flushMicrotasks();
  }));

  it('renders cached data and phase updates with editing disabled until completion', fakeAsync(() => {
    const { fixture, snapshots, complete } = setup();
    const root: HTMLElement = fixture.nativeElement;
    expect(fixture.componentInstance.loading).toBeTrue();
    expect(root.querySelector('.members-table tbody')?.textContent).toContain('EXAMPLE');
    expect(root.querySelector('.card-header .members-sync-notice')?.textContent).toContain('Données provisoires');
    expect(root.querySelector<HTMLButtonElement>('[aria-label="Archiver"]')?.disabled).toBeTrue();
    expect(root.querySelector<HTMLButtonElement>('[aria-label="Exporter les membres actifs au format CSV"]')?.disabled)
      .toBeTrue();
    expect(root.querySelector<HTMLButtonElement>('.member-sort-button')?.disabled).toBeFalse();

    const updated = { ...member, email: 'updated@example.fr' };
    snapshots.next([updated]);
    fixture.detectChanges();
    expect(root.querySelector('.members-table tbody')?.textContent).toContain(updated.email);
    complete([updated]);
    flushMicrotasks();
    fixture.detectChanges();

    expect(root.querySelector('.members-sync-notice')).toBeNull();
    expect(root.querySelector<HTMLButtonElement>('[aria-label="Archiver"]')?.disabled).toBeFalse();
  }));

  it('retains provisional data and exposes retry after synchronization fails', fakeAsync(() => {
    const { fixture, fail, toast } = setup();
    spyOn(console, 'error');
    fail(new Error('FFB unavailable'));
    flushMicrotasks();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('.members-table tbody')?.textContent).toContain('EXAMPLE');
    expect(root.querySelector('.alert-warning')).not.toBeNull();
    expect(root.querySelector<HTMLButtonElement>('[aria-label="Archiver"]')?.disabled).toBeTrue();
    expect(root.querySelector<HTMLButtonElement>('[aria-label="Actualiser le répertoire"]')?.disabled).toBeFalse();
    expect(toast.showError).toHaveBeenCalled();
  }));
});
