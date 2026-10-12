import { ClubMember } from '../ffb/interface/club-member.interface';
import { PersonV2 } from '../ffb/interface/person-v2.interface';
import { Member, LicenseStatus } from '../interfaces/member.interface';
import { MemberSyncService } from './member-sync.service';
import { of } from 'rxjs';

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
    const membersService = jasmine.createSpyObj('MembersService', ['updateMember', 'createMember', 'listMembers']);
    membersService.updateMember.and.resolveTo();
    membersService.listMembers.and.returnValue(of([member]));
    const ffbService = jasmine.createSpyObj('FFBProxyService', ['getFFBPerson']);
    ffbService.getFFBPerson.and.resolveTo(person);
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
    };
  }

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

  it('does not merge unrelated FFB members with an empty license number', async () => {
    const { service, membersService } = createService();
    const localWithoutLicense = {
      ...member,
      person_id: 999999,
      license_number: '',
    } as Member;
    const ffbWithoutLicense = { ...clubMember, license_number: '' } as ClubMember;

    await (service as any).createOrUpdateMember([localWithoutLicense], ffbWithoutLicense);

    expect(membersService.updateMember).not.toHaveBeenCalled();
    expect(membersService.createMember).toHaveBeenCalled();
  });
});