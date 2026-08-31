import { ClubMember } from '../ffb/interface/club-member.interface';
import { PersonV2 } from '../ffb/interface/person-v2.interface';
import { Member, LicenseStatus } from '../interfaces/member.interface';
import { MemberSyncService } from './member-sync.service';

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

  function createService() {
    const membersService = jasmine.createSpyObj('MembersService', ['updateMember', 'createMember']);
    membersService.updateMember.and.resolveTo();
    const ffbService = jasmine.createSpyObj('FFBProxyService', ['getFFBPerson']);
    ffbService.getFFBPerson.and.resolveTo(person);

    const service = new MemberSyncService(
      membersService,
      {} as any,
      ffbService,
      {} as any,
      {} as any,
    );

    return { service, membersService, ffbService };
  }

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
});