import { ClubMember } from '../ffb/interface/club-member.interface';
import { PersonV2 } from '../ffb/interface/person-v2.interface';
import { Member, LicenseStatus } from '../interfaces/member.interface';
import { MemberSyncService } from './member-sync.service';
import { MembersService } from './members.service';
import { Revenue } from '../interfaces/accounting.interface';
import { Subject, filter, firstValueFrom, of, take } from 'rxjs';

describe('MemberSyncService', () => {
  const clubMember = {
    id: 255110,
    license_number: '09465734',
    firstName: 'Dong',
    lastName: 'DUSSEUX',
    gender: 'F',
    birthdate: '1966-05-28T00:00:00+01:00',
    club: { label: 'BCSTO' },
    licence: false,
    season: { id: 1, category: 'senior', ranking: { iv: 56 } },
    mainRegistration: { free: false },
  } as ClubMember;

  const member = {
    id: '19f7ba14-d223-418f-9e1a-4df8fb0e2721',
    license_number: '09465734',
    firstname: 'Dong',
    lastname: 'DUSSEUX',
    gender: 'F',
    birthdate: '1966-05-28T00:00:00+01:00',
    city: '',
    email: '',
    phone_one: '',
    license_taken_at: '',
    license_status: LicenseStatus.UNREGISTERED,
    accept_mailing: false,
    membership_date: '2026-08-14',
    person_id: 255110,
    memberStatus: 'SYMPATHISANT',
    iv: 56,
  } as Member;

  const person = {
    email: 'dong.dusseux@example.fr',
  } as PersonV2;

  function createService(localSeason = '2026/2027', initializedSeason = '2026/2027') {
    const membersService = jasmine.createSpyObj(
      'MembersService',
      [
        'updateMember',
        'createMember',
        'listMembers',
        'buildFfbBaseReferences',
        'getLifecycleStatus',
        'hasPaidMembership',
        'isInFfbBase',
        'resolveMemberStatus',
        'deriveMemberStatusFromData',
        'full_name',
      ],
    );
    membersService.updateMember.and.resolveTo();
    membersService.listMembers.and.returnValue(of([member]));
    membersService.getLifecycleStatus.and.returnValue('ACTIVE');
    membersService.hasPaidMembership.and.returnValue(true);
    membersService.resolveMemberStatus.and.returnValue('SYMPATHISANT');
    membersService.deriveMemberStatusFromData.and.returnValue('SYMPATHISANT');
    membersService.full_name.and.callFake((candidate: Member) => `${candidate.lastname} ${candidate.firstname}`);
    membersService.buildFfbBaseReferences.and.returnValue(new Set([clubMember.id, clubMember.license_number]));
    membersService.isInFfbBase.and.callFake((candidate: Member, references: Set<number | string>) =>
      references.has(candidate.person_id as number) || references.has(candidate.license_number)
    );
    const ffbService = jasmine.createSpyObj('FFBProxyService', ['getFFBPerson', 'searchPlayersSuchAs']);
    ffbService.getFFBPerson.and.resolveTo(person);
    ffbService.searchPlayersSuchAs.and.resolveTo({ items: [], totalItems: 0, totalPages: 1, currentPage: 1 });
    const licenseesService = jasmine.createSpyObj('LicenseesService', ['getClubMembers$']);
    licenseesService.getClubMembers$.and.returnValue(of([clubMember]));
    const systemDataService = jasmine.createSpyObj(
      'SystemDataService',
      ['get_local_season', 'get_accounting_season_state', 'start_date'],
    );
    systemDataService.get_local_season.and.returnValue(localSeason);
    systemDataService.get_accounting_season_state.and.returnValue({ initializedSeason });
    systemDataService.start_date.and.returnValue('2026-07-01');
    const bookService = jasmine.createSpyObj(
      'BookService',
      ['list_book_entries', 'is_book_entries_loaded', 'get_operations'],
    );
    bookService.list_book_entries.and.returnValue(of([]));
    bookService.is_book_entries_loaded.and.returnValue(true);
    bookService.get_operations.and.returnValue([]);

    const service = new MemberSyncService(
      membersService,
      licenseesService,
      ffbService,
      systemDataService,
      bookService,
    );

    return {
      service,
      membersService,
      ffbService,
      licenseesService,
      bookService,
      systemDataService,
    };
  }

  it('publishes AWS members before FFB completes, then only at phase boundaries', async () => {
    const { service, licenseesService, membersService } = createService();
    const ffbMembers = new Subject<ClubMember[]>();
    licenseesService.getClubMembers$.and.returnValue(ffbMembers);
    const snapshots: Member[][] = [];
    const subscription = service.syncMembers$.subscribe(snapshot => {
      if (snapshot !== null) snapshots.push(snapshot);
    });
    const initialSnapshot = firstValueFrom(service.syncMembers$.pipe(
      filter((snapshot): snapshot is Member[] => snapshot !== null),
      take(1),
    ));
    const synchronization = service.ensureMembersSynchronized();

    expect(await initialSnapshot).toEqual([member]);
    expect(snapshots.length).toBe(1);
    expect(snapshots[0][0]).not.toBe(member);
    expect(membersService.updateMember).not.toHaveBeenCalled();

    ffbMembers.next([clubMember, { ...clubMember }]);
    await synchronization;

    expect(snapshots.length).toBe(6);
    subscription.unsubscribe();
  });

  it('reuses a successful synchronization throughout the session and returns current cached members', async () => {
    const { service, membersService, licenseesService, bookService, ffbService } = createService();
    await service.ensureMembersSynchronized();
    const cachedMember = { ...member, email: 'updated@example.fr' };
    membersService.listMembers.and.returnValue(of([cachedMember]));
    const updateCount = membersService.updateMember.calls.count();
    const personLookupCount = ffbService.getFFBPerson.calls.count();
    const later = Date.now() + 60 * 60 * 1000;
    spyOn(Date, 'now').and.returnValue(later);

    expect(await service.ensureMembersSynchronized()).toEqual([cachedMember]);
    expect(licenseesService.getClubMembers$).toHaveBeenCalledOnceWith(true);
    expect(bookService.list_book_entries).toHaveBeenCalledTimes(1);
    expect(membersService.listMembers.calls.allArgs().filter((args: [boolean?]) => args[0] === true).length).toBe(1);
    expect(membersService.updateMember).toHaveBeenCalledTimes(updateCount);
    expect(ffbService.getFFBPerson).toHaveBeenCalledTimes(personLookupCount);
  });

  it('does not repeat external-license searches when returning in the same session', async () => {
    const { service, membersService, ffbService } = createService();
    membersService.listMembers.and.returnValue(of([
      member,
      { ...member, id: 'external', person_id: 987654, license_number: '01234567' },
    ]));
    await service.ensureMembersSynchronized();
    const lookupCount = ffbService.searchPlayersSuchAs.calls.count();
    expect(lookupCount).toBeGreaterThan(0);

    await service.ensureMembersSynchronized();

    expect(ffbService.searchPlayersSuchAs).toHaveBeenCalledTimes(lookupCount);
  });

  it('runs a new scan when explicitly forced', async () => {
    const { service, licenseesService, bookService } = createService();
    await service.ensureMembersSynchronized();
    await service.ensureMembersSynchronized(true);

    expect(licenseesService.getClubMembers$).toHaveBeenCalledTimes(2);
    expect(bookService.list_book_entries).toHaveBeenCalledTimes(2);
  });

  it('does not reuse a synchronization from another season', async () => {
    const { service, systemDataService, licenseesService } = createService();
    await service.ensureMembersSynchronized();
    systemDataService.get_local_season.and.returnValue('2027/2028');
    systemDataService.get_accounting_season_state.and.returnValue({ initializedSeason: '2027/2028' });
    await service.ensureMembersSynchronized();

    expect(licenseesService.getClubMembers$).toHaveBeenCalledTimes(2);
  });

  it('retries after a forced synchronization fails', async () => {
    const { service, licenseesService } = createService();
    await service.ensureMembersSynchronized();
    licenseesService.getClubMembers$.and.returnValue(of([]));
    await expectAsync(service.ensureMembersSynchronized(true)).toBeRejectedWithError(/aucun adhérent/);
    licenseesService.getClubMembers$.and.returnValue(of([clubMember]));

    await service.ensureMembersSynchronized();

    expect(licenseesService.getClubMembers$).toHaveBeenCalledTimes(3);
  });

  it('shares an ongoing scan between simultaneous callers', async () => {
    const { service, licenseesService } = createService();
    const [first, second] = await Promise.all([
      service.ensureMembersSynchronized(),
      service.ensureMembersSynchronized(),
    ]);

    expect(second).toEqual(first);
    expect(licenseesService.getClubMembers$).toHaveBeenCalledTimes(1);
  });

  it('does not mark a scan interrupted by a season change as successful', async () => {
    const { service, systemDataService, bookService, licenseesService } = createService();
    bookService.get_operations.and.callFake(() => {
      systemDataService.get_local_season.and.returnValue('2025/2026');
      return [];
    });
    await service.ensureMembersSynchronized();
    systemDataService.get_local_season.and.returnValue('2026/2027');
    bookService.get_operations.and.returnValue([]);

    await service.ensureMembersSynchronized();

    expect(licenseesService.getClubMembers$).toHaveBeenCalledTimes(2);
  });

  [
    { label: 'person ID', repeated: { ...clubMember } },
    { label: 'license number', repeated: { ...clubMember, id: 255111 } },
  ].forEach(({ label, repeated }) => {
    it(`does not recreate a new sympathisant repeated by ${label} after a cache update`, async () => {
      const { licenseesService, ffbService, systemDataService, bookService } = createService();
      const existingMember: Member = {
        ...member,
        id: 'existing-member',
        person_id: 123456,
        license_number: '01234567',
        firstname: 'Alex',
        lastname: 'EXAMPLE',
        email: 'alex@example.fr',
        membership_date: '',
      };
      const existingClubMember = {
        ...clubMember,
        id: existingMember.person_id,
        license_number: existingMember.license_number,
        firstName: existingMember.firstname,
        lastName: existingMember.lastname,
      } as ClubMember;
      const dbHandler = jasmine.createSpyObj('DBhandler', ['listMembers', 'createMember', 'updateMember']);
      let storedMembers = [existingMember];
      dbHandler.listMembers.and.callFake(() => of([...storedMembers]));
      dbHandler.createMember.and.callFake(async (input: Omit<Member, 'id'>): Promise<Member> => {
        const created = { ...input, id: `created-${dbHandler.createMember.calls.count()}` };
        storedMembers.push(created);
        return created;
      });
      dbHandler.updateMember.and.callFake(async (updated: Member): Promise<Member> => {
        storedMembers = storedMembers.map((candidate) => candidate.id === updated.id ? updated : candidate);
        return updated;
      });
      const membersService = new MembersService(
        jasmine.createSpyObj('ToastService', ['showError', 'showWarning', 'showSuccess']),
        dbHandler,
        systemDataService,
      );
      const service = new MemberSyncService(
        membersService, licenseesService, ffbService, systemDataService, bookService,
      );
      licenseesService.getClubMembers$.and.returnValue(of([
        existingClubMember, clubMember, repeated,
      ]));

      const synchronized = await service.ensureMembersSynchronized(true);

      expect(dbHandler.createMember).toHaveBeenCalledTimes(1);
      expect(synchronized.length).toBe(2);
      const sympathisant = synchronized.find((candidate) => candidate.id === 'created-1')!;
      expect(sympathisant.memberStatus).toBe('SYMPATHISANT');
      expect(membersService.canPurchase(sympathisant)).toBeTrue();
      expect(sympathisant.membership_date).toBe('');

      const membershipSale: Revenue = {
        book_entry_id: 'cash-sale',
        season: '2026/2027',
        label: '',
        member: membersService.full_name(sympathisant),
        date: '2026-11-06',
        values: { ADH: 35, CAR: 30 },
      };
      bookService.get_operations.and.returnValue([membershipSale]);
      const afterSale = await service.ensureMembersSynchronized(true);

      expect(dbHandler.createMember).toHaveBeenCalledTimes(1);
      expect(afterSale.length).toBe(2);
      expect(afterSale.find((candidate) => candidate.id === sympathisant.id)?.membership_date)
        .toBe('2026-11-06');
    });
  });

  it('reloads AWS before matching a FFB identity created in another session', async () => {
    const { licenseesService, ffbService, systemDataService, bookService } = createService();
    const dbHandler = jasmine.createSpyObj('DBhandler', ['listMembers', 'createMember', 'updateMember']);
    dbHandler.listMembers.and.returnValue(of([]));
    dbHandler.updateMember.and.callFake(async (updated: Member): Promise<Member> => updated);
    const membersService = new MembersService(
      jasmine.createSpyObj('ToastService', ['showError', 'showWarning', 'showSuccess']),
      dbHandler,
      systemDataService,
    );
    await firstValueFrom(membersService.listMembers());
    dbHandler.listMembers.and.returnValue(of([{ ...member, email: person.email }]));
    const service = new MemberSyncService(
      membersService, licenseesService, ffbService, systemDataService, bookService,
    );

    const result = await service.ensureMembersSynchronized(true);

    expect(dbHandler.listMembers).toHaveBeenCalledTimes(2);
    expect(dbHandler.createMember).not.toHaveBeenCalled();
    expect(result.map((candidate) => candidate.id)).toEqual([member.id]);
  });

  it('returns members without synchronizing when an historical season is selected', async () => {
    const {
      service,
      membersService,
      ffbService,
      licenseesService,
      bookService,
    } = createService('2025/2026', '2026/2027');

    const result = await service.ensureMembersSynchronized(true);

    expect(result).toEqual([member]);
    expect(licenseesService.getClubMembers$).not.toHaveBeenCalled();
    expect(bookService.list_book_entries).not.toHaveBeenCalled();
    expect(ffbService.getFFBPerson).not.toHaveBeenCalled();
    expect(membersService.updateMember).not.toHaveBeenCalled();
    expect(membersService.createMember).not.toHaveBeenCalled();
  });

  it('backfills an empty email from the FFB person without changing mailing consent', async () => {
    const { service, membersService, ffbService } = createService();

    await (service as any).createOrUpdateMember([member], clubMember);

    expect(ffbService.getFFBPerson).toHaveBeenCalledOnceWith(255110);
    expect(membersService.updateMember).toHaveBeenCalledWith(jasmine.objectContaining({
      email: 'dong.dusseux@example.fr',
      accept_mailing: false,
    }));
  });

  it('preserves an existing email without loading the FFB person', async () => {
    const { service, membersService, ffbService } = createService();
    const existingMember = { ...member, email: 'local@example.fr' };

    await (service as any).createOrUpdateMember([existingMember], clubMember);

    expect(ffbService.getFFBPerson).not.toHaveBeenCalled();
    expect(membersService.updateMember).toHaveBeenCalledWith(jasmine.objectContaining({
      email: 'local@example.fr',
    }));
  });

  it('does not reset licenses when the FFB member list is empty', async () => {
    const { service, membersService } = createService();
    const licensedMember = { ...member, license_status: LicenseStatus.DULY_REGISTERED };

    await expectAsync((service as any).resetObsoleteLicenses([licensedMember], []))
      .toBeRejectedWithError(/liste FFB est vide/i);
    expect(membersService.updateMember).not.toHaveBeenCalled();
  });

  it('stores the current FFB date and club for a member outside the club base', async () => {
    const { service, membersService, ffbService } = createService();
    membersService.hasPaidMembership.and.returnValue(false);
    const outsideMember = {
      ...member,
      id: 'outside-member',
      person_id: 987654,
      license_number: '01234567',
      register_date: '2025-09-01',
      license_taken_at: 'Bridge Club de Saint Orens',
    } as Member;
    const externalLicense = {
      ...clubMember,
      id: 987654,
      license_number: '01234567',
      licence: true,
      club: { ...clubMember.club, label: 'Bridge Club de Toulouse' },
      mainRegistration: { free: false, createdAt: '2026-10-03T09:30:00+02:00' },
    } as ClubMember;
    ffbService.searchPlayersSuchAs.and.resolveTo({
      items: [externalLicense],
      totalItems: 1,
      totalPages: 1,
      currentPage: 1,
    });

    await (service as any).syncExternalLicenseDetails([outsideMember], [clubMember]);

    expect(ffbService.searchPlayersSuchAs).toHaveBeenCalledOnceWith('1234567', { maxPerPage: 10 });
    expect(membersService.updateMember).toHaveBeenCalledWith(jasmine.objectContaining({
      id: 'outside-member',
      license_taken_at: 'Bridge Club de Saint Orens',
      orga_license_name: 'Bridge Club de Toulouse',
      register_date: '2026-10-03',
    }));
    expect((service as any).syncProgressSubject.value).toEqual({
      percent: 94,
      label: 'Recherche des licences externes : 1/1',
    });
  });

  it('matches a FFB member by person_id before license number', async () => {
    const { service, membersService } = createService();
    const samePerson = {
      ...member,
      license_number: '',
      lifecycleStatus: 'ARCHIVED',
    } as Member;
    const ffbWithoutLicense = { ...clubMember, license_number: '' } as ClubMember;

    await (service as any).createOrUpdateMember([samePerson], ffbWithoutLicense);

    expect(membersService.createMember).not.toHaveBeenCalled();
    expect(membersService.updateMember).toHaveBeenCalledWith(jasmine.objectContaining({
      id: samePerson.id,
      lifecycleStatus: 'ARCHIVED',
    }));
  });

  it('suspends creation when an existing member has the same normalized name', async () => {
    const { service, membersService } = createService();
    const localWithoutLicense = {
      ...member,
      person_id: 999999,
      license_number: '',
    } as Member;
    const ffbWithoutLicense = { ...clubMember, license_number: '' } as ClubMember;

    await (service as any).createOrUpdateMember([localWithoutLicense], ffbWithoutLicense);

    expect(membersService.updateMember).not.toHaveBeenCalled();
    expect(membersService.createMember).not.toHaveBeenCalled();
    expect(service.getPendingMergeConflicts()).toEqual([
      jasmine.objectContaining({
        clubMember: ffbWithoutLicense,
        candidates: [localWithoutLicense],
      }),
    ]);
  });

  it('offers every local homonym as a merge candidate', async () => {
    const { service, membersService } = createService();
    const firstCandidate = {
      ...member,
      id: 'first-candidate',
      person_id: undefined,
      license_number: '??DUSDON',
    } as Member;
    const secondCandidate = {
      ...firstCandidate,
      id: 'second-candidate',
      license_number: '',
    } as Member;

    await (service as any).createOrUpdateMember([firstCandidate, secondCandidate], clubMember);

    expect(membersService.createMember).not.toHaveBeenCalled();
    expect(service.getPendingMergeConflicts()[0].candidates).toEqual([
      firstCandidate,
      secondCandidate,
    ]);
  });

  it('creates a new member immediately when no local identity matches', async () => {
    const { service, membersService } = createService();
    const unrelatedMember = {
      ...member,
      firstname: 'Alice',
      lastname: 'MARTIN',
      person_id: undefined,
      license_number: '',
    } as Member;

    await (service as any).createOrUpdateMember([unrelatedMember], clubMember);

    expect(membersService.createMember).toHaveBeenCalledWith(jasmine.objectContaining({
      person_id: clubMember.id,
      license_number: clubMember.license_number,
    }));
    expect(service.getPendingMergeConflicts()).toEqual([]);
  });

  it('merges an FFB identity into the selected historical member', async () => {
    const { service, membersService } = createService();
    const historicalMember = {
      ...member,
      id: 'historical-member',
      firstname: 'Françoise',
      lastname: 'RAMOS',
      license_number: '??RAMFra',
      person_id: undefined,
      email: 'local@example.fr',
    } as Member;
    const ramosFfb = {
      ...clubMember,
      id: 277263,
      firstName: 'Francoise',
      lastName: 'RAMOS',
      license_number: '24827406',
      licence: true,
    } as ClubMember;

    await (service as any).createOrUpdateMember([historicalMember], ramosFfb);
    const [conflict] = service.getPendingMergeConflicts();
    await service.mergeMemberConflict(conflict, historicalMember.id);

    expect(membersService.createMember).not.toHaveBeenCalled();
    expect(membersService.updateMember).toHaveBeenCalledWith(jasmine.objectContaining({
      id: historicalMember.id,
      person_id: ramosFfb.id,
      license_number: ramosFfb.license_number,
      email: historicalMember.email,
    }));
    expect(service.getPendingMergeConflicts()).toEqual([]);
  });

  it('creates a distinct member when the administrator confirms an homonym', async () => {
    const { service, membersService } = createService();
    const homonym = {
      ...member,
      person_id: 999999,
      license_number: '09999999',
    } as Member;

    await (service as any).createOrUpdateMember([homonym], clubMember);
    const [conflict] = service.getPendingMergeConflicts();
    await service.createDistinctMember(conflict);

    expect(membersService.updateMember).not.toHaveBeenCalled();
    expect(membersService.createMember).toHaveBeenCalledWith(jasmine.objectContaining({
      person_id: clubMember.id,
      license_number: clubMember.license_number,
    }));
    expect(service.getPendingMergeConflicts()).toEqual([]);
  });
});