import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { MembersService, MemberStatus } from '../../common/services/members.service';
import { Observable, take, firstValueFrom } from 'rxjs';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule, UpperCasePipe } from '@angular/common';
import { NgbModal, NgbTooltipModule, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { GetNewbeeComponent } from '../modals/get-newbee/get-newbee.component';
import { InputPlayerComponent } from '../ffb/input-licensee/input-player.component';
import { ClubMember } from '../ffb/interface/club-member.interface';
import { Member, LicenseStatus } from '../interfaces/member.interface';
import { SystemDataService } from '../services/system-data.service';
import { ToastService } from '../services/toast.service';
import { PhonePipe } from '../pipes/phone.pipe';
import { MemberSettingsService } from '../services/member-settings.service';
import { FFB_proxyService } from '../ffb/services/ffb.service';
import { PersonV2 } from '../ffb/interface/person-v2.interface';
import { normalizeGender } from '../utils/gender.util';
import { MemberSyncService } from '../services/member-sync.service';

type MemberStatusConfig = {
  label: string;
  iconClass: string;
};

@Component({
  selector: 'app-members',
  standalone: true,
  encapsulation: ViewEncapsulation.None, // nécessaire pour que les CSS des tooltips fonctionnent
  imports: [FormsModule, CommonModule, ReactiveFormsModule, UpperCasePipe, InputPlayerComponent, NgbTooltipModule, NgbDropdownModule, PhonePipe],
  templateUrl: './members.component.html',
  styleUrl: './members.component.scss'
})
export class MembersComponent implements OnInit {
  members: Member[] = [];
  filteredMembers: Member[] = [];
  ffb_adherents_nbr: number = 0;
  club_licensees_nbr: number = 0;
  sympatisants_number: number = 0;
  no_license_nbr: number = 0;
  lost_members_nbr: number = 0;
  new_player!: ClubMember;
  season: string = '';
  STATUSES = MemberStatus;
  filters: MemberStatus[] = [
    MemberStatus.ADHERENT,
    MemberStatus.CLUB_LICENSEE,
    MemberStatus.SYMPATHISANT,
    MemberStatus.NO_LICENSE,
    MemberStatus.NON_ADHERENT,
  ];
  statusConfig: Record<MemberStatus, MemberStatusConfig> = {
    [MemberStatus.ADHERENT]: { label: 'vue FFB', iconClass: 'bi bi-person-check-fill' },
    [MemberStatus.CLUB_LICENSEE]: { label: 'adhérent licencié', iconClass: 'bi bi-person-square' },
    [MemberStatus.SYMPATHISANT]: { label: 'sympathisant', iconClass: 'bi bi-tencent-qq' },
    [MemberStatus.NO_LICENSE]: { label: 'adhérent sans n° de licence', iconClass: 'bi bi-mortarboard-fill' },
    [MemberStatus.NON_ADHERENT]: { label: 'adhésion non renouvelée', iconClass: 'bi bi-heartbreak-fill' },
  };
  selected_filter: MemberStatus = MemberStatus.ADHERENT;
  statusLegend: MemberStatus[] = [
    MemberStatus.CLUB_LICENSEE,
    MemberStatus.SYMPATHISANT,
    MemberStatus.NO_LICENSE,
    MemberStatus.NON_ADHERENT,
  ];
  loading: boolean = true;
  avatar_urls$: { [key: string]: Observable<string> } = {};

  // For dynamic info column in members table
  infoColumns = ['license_number', 'membership_date', 'register_date', 'email', 'birthdate', 'phone_one', 'city', 'accept_mailing'];
  infoColumnLabels: { [key: string]: string } = {
    license_number: 'Licence',
    membership_date: "Date d'adhésion",
    register_date: "Date de licence",
    email: 'Mail',
    birthdate: 'Date naissance',
    phone_one: 'Téléphone',
    city: 'Ville',
    accept_mailing: 'Accepte mails',
  };
  selectedInfoColumn: string = 'membership_date';

  // radioButtonGroup: FormGroup = new FormGroup({
  //   radioButton: new FormControl('Tous')
  // });

  constructor(
    private membersService: MembersService,
    private memberSettingsService: MemberSettingsService,
    private sysConfService: SystemDataService,
    private modalService: NgbModal,
    private toastService: ToastService,
    private ffbService: FFB_proxyService,
    private memberSyncService: MemberSyncService,
  ) {
  }

  ngOnInit(): void {

    let today = new Date();
    this.season = this.sysConfService.get_season(today);

    this.loading = true;
    void (async () => {
      try {
        const members = await this.memberSyncService.ensureMembersSynchronized(true);
        this.members = members.sort((a, b) => a.lastname.localeCompare(b.lastname, 'fr', { sensitivity: 'base' }));
        this.applyStatusCounters();
        this.avatar_urls$ = this.collect_avatars(this.members);
        this.filterOnStatus(this.selected_filter);
      } catch (err) {
        console.error('Erreur lors du chargement des membres:', err);
        this.toastService.showError('Membres', 'Erreur lors du chargement des membres');
      } finally {
        this.loading = false;
      }
    })();
  }


  collect_avatars(members: Member[]): { [key: string]: Observable<string> } {
    const avatarUrls: { [key: string]: Observable<string> } = {};
    members.forEach((member: Member) => {
      avatarUrls[member.license_number] = this.memberSettingsService.getAvatarUrl(member);
    });
    return avatarUrls;
  }

  private applyStatusCounters(): void {
    const counters = this.membersService.computeStatusCountersFromMembers();
    this.club_licensees_nbr = counters.clubLicensees;
    this.sympatisants_number = counters.sympathisants;
    this.ffb_adherents_nbr = counters.ffbAdherents;
    this.no_license_nbr = counters.noLicense;
    this.lost_members_nbr = counters.nonAdherents;
  }

  async add_licensee(player: ClubMember) {
    if (!player) { return; }

    const personV2 = await this.ffbService.getFFBPerson(player.id).catch(() => null);
    const new_member: Member = this.createNewMember(player, personV2);
    console.log('Ajout d\'un nouveau membre :', new_member);
    this.memberSyncService.createMemberWithComputedStatus(new_member).then(() => {
      this.refreshMembers();
      this.new_player = null as any;
    });
  }

  addNewbee() {
    const modalRef = this.modalService.open(GetNewbeeComponent, { centered: true });

    modalRef.result.then((newbee: any) => {
      if (newbee) {
        // Vérifier si l'email existe déjà
        this.membersService.searchMemberByEmail(newbee.email).then((existingMember) => {
          if (existingMember) {
            this.toastService.showWarning('Nouveau membre', `Un membre avec l'email ${newbee.email} existe déjà`);
            return;
          }

          let new_member: Member = {
            id: '',
            gender: normalizeGender(newbee.gender),
            firstname: newbee.firstname,
            lastname: newbee.lastname.toUpperCase(),
            license_number: '??' + newbee.lastname.toUpperCase().slice(0, 3) + newbee.firstname.slice(0, 3),
            birthdate: newbee.birthdate,
            city: this.capitalizeFirst(newbee.city.toLowerCase()),
            season: '',
            email: newbee.email ?? '',
            phone_one: newbee.phone ?? '',
            license_taken_at: 'BCSTO',
            license_status: LicenseStatus.UNREGISTERED,
            accept_mailing: newbee.email ? true : false,
            has_avatar: false,
            membership_date: '',
            memberStatus: 'NON_ADHERENT',
            person_id: undefined,
            iv: undefined
          }
          this.memberSyncService.createMemberWithComputedStatus(new_member).then((_member) => {
            this.toastService.showSuccess('Nouveau membre non licencié', new_member.lastname + ' ' + new_member.firstname);
            this.refreshMembers();
          });
        });
      }

    });
  }

  capitalizeFirst(str: string | undefined): string {
    if (!str) return '';
    str = str.replace(/^(\w)(.+)/, (match, p1, p2) => p1.toUpperCase() + p2.toLowerCase())
    return str;
  }

  private isAdherent(member: Member): boolean {
    return this.getMemberStatus(member) !== MemberStatus.NON_ADHERENT;
  }

  getMemberStatus(member: Member): MemberStatus {
    return this.membersService.resolveMemberStatus(member);
  }

  private matchesFilter(member: Member, filter: MemberStatus): boolean {
    if (filter === MemberStatus.ADHERENT) {
      return this.isAdherent(member);
    }

    return this.getMemberStatus(member) === filter;
  }

  filterOnStatus(filter: MemberStatus) {
    this.selected_filter = filter;
    this.filteredMembers = this.members
      .filter((member: Member) => this.matchesFilter(member, filter))
      .sort((a, b) => a.lastname.localeCompare(b.lastname, 'fr', { sensitivity: 'base' }));
  }

  getStatusLabel(status: MemberStatus): string {
    return this.statusConfig[status].label;
  }

  getFilterIconClass(status: MemberStatus): string {
    return this.statusConfig[status].iconClass;
  }

  getMemberStatusIconClass(member: Member): string {
    return this.getFilterIconClass(this.getMemberStatus(member));
  }

  isStatusWarning(member: Member): boolean {
    return member.license_status === LicenseStatus.UNREGISTERED
      || (this.membersService.isLicensed(member) && !this.membersService.hasPaidMembership(member));
  }

  getMemberStatusTooltip(member: Member): string {
    const status = this.getMemberStatus(member);

    if (status === MemberStatus.SYMPATHISANT) {
      if (!this.membersService.isLicensed(member)) {
        return 'Sympathisant rattaché FFB, licence non encore prise.';
      }
      return `Sympathisant licencié au ${member.license_taken_at}`;
    }

    if (status === MemberStatus.CLUB_LICENSEE && this.isStatusWarning(member)) {
      return 'Membre licencié au club. Paiement adhésion à régulariser.';
    }

    return this.getStatusLabel(status);
  }


  createNewMember(clubMember: ClubMember, personV2: PersonV2 | null): Member {
    return {
      id: '',
      gender: normalizeGender(clubMember.gender),
      firstname: clubMember.firstName,
      lastname: clubMember.lastName.toUpperCase(),
      license_number: clubMember.license_number,
      birthdate: clubMember.birthdate,
      city: personV2?.city ?? '',
      season: clubMember.licence ? this.season : '',
      email: personV2?.email ?? '',
      accept_mailing: personV2?.email ? true : false,
      phone_one: personV2?.phone ?? '',
      license_status: clubMember.licence ? LicenseStatus.DULY_REGISTERED : LicenseStatus.UNREGISTERED,
      license_taken_at: clubMember.club?.label ?? 'BCSTO',
      register_date: clubMember.mainRegistration?.createdAt ? clubMember.mainRegistration.createdAt.split('T')[0] : '',
      membership_date: '',
      has_avatar: false,
      person_id: clubMember.id,
      memberStatus: clubMember.licence ? 'CLUB_LICENSEE' : 'SYMPATHISANT',
      iv: undefined,
      iv_code: undefined,
    }
  }
  deleteMember(member: Member) {
    this.membersService.deleteMember(member).then(() => {
      this.refreshMembers();
    });
  }

  private refreshMembers(): void {
    void this.refreshMembersAsync();
  }

  private async refreshMembersAsync(): Promise<void> {
    const members = await firstValueFrom(this.membersService.listMembers().pipe(take(1)));
    this.members = members.sort((a, b) => a.lastname.localeCompare(b.lastname, 'fr', { sensitivity: 'base' }));
    this.applyStatusCounters();
    this.avatar_urls$ = this.collect_avatars(this.members);
    this.filterOnStatus(this.selected_filter);
  }

  accessSettings(member: Member): void {
    this.memberSettingsService.access_settings(member).subscribe((settings_changed) => {
      if (settings_changed) {
        // this.toastService.showSuccess(`Préférences de ${this.membersService.full_name(member)}`, 'Mise à jour effectuée');
      }
    });
  }

  getIvCode(iv: number | undefined): string {
    if (iv === undefined) return '';
    return this.membersService.iv_code(iv);
  }

  /**
   * Parse IV code into series and symbol parts for display
   * Only card suits (♥, ♦, ♣, ♠) are colored/bold, not series or SA/N
   * Examples: "4♥" → {series: "4", suit: "♥", suitColor: "#d32f2f", tail: ""}
   *           "4SA" → {series: "4", suit: "", suitColor: "#000", tail: "SA"}
   */
  getIvCodeParts(iv: number | undefined): { series: string; suit: string; suitColor: string; tail: string } {
    const code = this.getIvCode(iv);
    
    // Extract: series (leading digits), suit (one of ♥♦♣♠), tail (SA/N or empty)
    const match = code.match(/^(\d*)([♥♦♣♠]?)(.*)$/);
    
    if (match) {
      const series = match[1];
      const suit = match[2];
      const tail = match[3];
      // Only suits get color
      const suitColor = (suit === '♥' || suit === '♦') ? '#d32f2f' : '#000';
      return { series, suit, suitColor, tail };
    }
    
    // Fallback for codes like "NVL", "NC"
    return { series: code, suit: '', suitColor: '#000', tail: '' };
  }

}
