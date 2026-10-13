import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { MembersService, MemberStatus } from '../../common/services/members.service';
import { Observable, Subject, distinctUntilKeyChanged, firstValueFrom, skip, take, takeUntil } from 'rxjs';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule, UpperCasePipe } from '@angular/common';
import { NgbModal, NgbTooltipModule, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { GetNewbeeComponent } from '../modals/get-newbee/get-newbee.component';
import { InputPlayerComponent } from '../ffb/input-licensee/input-player.component';
import { ClubMember } from '../ffb/interface/club-member.interface';
import { Member, LicenseStatus, MemberLifecycleStatus } from '../interfaces/member.interface';
import { ToastService } from '../services/toast.service';
import { PhonePipe } from '../pipes/phone.pipe';
import { MemberSettingsService } from '../services/member-settings.service';
import { FFB_proxyService } from '../ffb/services/ffb.service';
import { PersonV2 } from '../ffb/interface/person-v2.interface';
import { normalizeGender } from '../utils/gender.util';
import { MemberSyncService } from '../services/member-sync.service';
import { SystemDataService } from '../services/system-data.service';
import { AuthentificationService } from '../authentification/authentification.service';

type MemberStatusConfig = {
  label: string;
  iconClass: string;
};

type DirectoryFilter = MemberStatus | MemberLifecycleStatus;

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
  ffb_club_attached_nbr: number = 0;
  club_licensees_nbr: number = 0;
  sympatisants_number: number = 0;
  outside_ffb_nbr: number = 0;
  lost_members_nbr: number = 0;
  active_members_nbr = 0;
  selected_members_nbr = 0;
  renewed_members_nbr = 0;
  club_licensees_renewed_nbr = 0;
  club_licensees_unrenewed_nbr = 0;
  sympathisants_renewed_nbr = 0;
  sympathisants_unrenewed_nbr = 0;
  ffb_renewed_members_nbr = 0;
  ffb_unrenewed_members_nbr = 0;
  outside_ffb_renewed_members_nbr = 0;
  outside_ffb_unrenewed_members_nbr = 0;
  archived_members_nbr = 0;
  banned_members_nbr = 0;
  new_player!: ClubMember;
  STATUSES = MemberStatus;
  filters: MemberStatus[] = [
    MemberStatus.CLUB_LICENSEE,
    MemberStatus.SYMPATHISANT,
    MemberStatus.FFB_CLUB_ATTACHED,
    MemberStatus.OUTSIDE_FFB_CLUB,
  ];
  statusConfig: Record<DirectoryFilter, MemberStatusConfig> = {
    ACTIVE: { label: 'tous les actifs', iconClass: 'bi bi-people-fill' },
    ARCHIVED: { label: 'anciens membres', iconClass: 'bi bi-archive-fill' },
    BANNED: { label: 'membres bannis', iconClass: 'bi bi-person-fill-slash' },
    [MemberStatus.FFB_CLUB_ATTACHED]: { label: 'présent dans la base FFB du club', iconClass: 'bi bi-ffb-fill' },
    [MemberStatus.CLUB_LICENSEE]: { label: 'licence FFB au club', iconClass: 'bi bi-person-square' },
    [MemberStatus.SYMPATHISANT]: { label: 'sympathisant', iconClass: 'bi bi-tencent-qq' },
    [MemberStatus.OUTSIDE_FFB_CLUB]: { label: 'hors base FFB du club', iconClass: 'bi bi-person-dash' },
    [MemberStatus.NON_ADHERENT]: { label: 'sans adhésion', iconClass: 'bi bi-people-fill text-danger' },
  };
  selectedLifecycleFilter: MemberLifecycleStatus = 'ACTIVE';
  selectedStatusFilter: MemberStatus | null = null;
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
  private readonly destroy$ = new Subject<void>();
  private seasonRefreshInFlight = false;
  private pendingSeasonRefresh = false;

  // radioButtonGroup: FormGroup = new FormGroup({
  //   radioButton: new FormControl('Tous')
  // });

  constructor(
    private membersService: MembersService,
    private memberSettingsService: MemberSettingsService,
    private modalService: NgbModal,
    private toastService: ToastService,
    private ffbService: FFB_proxyService,
    private memberSyncService: MemberSyncService,
    private systemDataService: SystemDataService,
    private auth: AuthentificationService,
  ) {
  }

  ngOnInit(): void {
    this.loading = true;
    this.systemDataService.get_configuration().pipe(
      distinctUntilKeyChanged('season'),
      skip(1),
      takeUntil(this.destroy$),
    ).subscribe(() => {
      void this.handleSeasonChange();
    });

    this.memberSettingsService.settingsChange$().pipe(
      skip(1),
      takeUntil(this.destroy$),
    ).subscribe(() => {
      this.avatar_urls$ = this.collect_avatars(this.members);
      this.applyFilters();
    });

    void this.loadMembersWithSynchronization(true);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }


  collect_avatars(members: Member[]): { [key: string]: Observable<string> } {
    const avatarUrls: { [key: string]: Observable<string> } = {};
    members.forEach((member: Member) => {
      avatarUrls[member.license_number] = this.memberSettingsService.getAvatarUrl(member);
    });
    return avatarUrls;
  }

  private applyStatusCounters(): void {
    const membersByLifecycle = {
      ACTIVE: this.members.filter((member) => this.membersService.getLifecycleStatus(member) === 'ACTIVE'),
      ARCHIVED: this.members.filter((member) => this.membersService.getLifecycleStatus(member) === 'ARCHIVED'),
      BANNED: this.members.filter((member) => this.membersService.getLifecycleStatus(member) === 'BANNED'),
    };
    this.active_members_nbr = membersByLifecycle.ACTIVE.length;
    this.archived_members_nbr = membersByLifecycle.ARCHIVED.length;
    this.banned_members_nbr = membersByLifecycle.BANNED.length;

    const selectedMembers = membersByLifecycle[this.selectedLifecycleFilter];
    const clubLicensees = selectedMembers.filter((member) =>
      this.membersService.resolveMemberStatus(member) === MemberStatus.CLUB_LICENSEE
    );
    const sympathisants = selectedMembers.filter((member) =>
      this.membersService.resolveMemberStatus(member) === MemberStatus.SYMPATHISANT
    );
    const ffbMembers = selectedMembers.filter((member) => this.membersService.isFfbAttached(member));
    const outsideFfbMembers = selectedMembers.filter((member) => !this.membersService.isFfbAttached(member));

    this.selected_members_nbr = selectedMembers.length;
    this.club_licensees_nbr = clubLicensees.length;
    this.sympatisants_number = sympathisants.length;
    this.ffb_club_attached_nbr = ffbMembers.length;
    this.outside_ffb_nbr = outsideFfbMembers.length;
    this.renewed_members_nbr = selectedMembers.filter((member) => this.membersService.hasPaidMembership(member)).length;
    this.lost_members_nbr = selectedMembers.length - this.renewed_members_nbr;
    this.club_licensees_renewed_nbr = clubLicensees.filter((member) => this.membersService.hasPaidMembership(member)).length;
    this.club_licensees_unrenewed_nbr = clubLicensees.length - this.club_licensees_renewed_nbr;
    this.sympathisants_renewed_nbr = sympathisants.filter((member) => this.membersService.hasPaidMembership(member)).length;
    this.sympathisants_unrenewed_nbr = sympathisants.length - this.sympathisants_renewed_nbr;
    this.ffb_renewed_members_nbr = ffbMembers.filter((member) => this.membersService.hasPaidMembership(member)).length;
    this.ffb_unrenewed_members_nbr = ffbMembers.length - this.ffb_renewed_members_nbr;
    this.outside_ffb_renewed_members_nbr = outsideFfbMembers.filter((member) => this.membersService.hasPaidMembership(member)).length;
    this.outside_ffb_unrenewed_members_nbr = outsideFfbMembers.length - this.outside_ffb_renewed_members_nbr;
  }

  private applyMembers(members: Member[]): void {
    this.members = members.sort((a, b) => a.lastname.localeCompare(b.lastname, 'fr', { sensitivity: 'base' }));
    this.applyStatusCounters();
    this.avatar_urls$ = this.collect_avatars(this.members);
    this.applyFilters();
  }

  private async loadMembersWithSynchronization(forceSync: boolean): Promise<void> {
    this.loading = true;
    try {
      const members = await this.memberSyncService.ensureMembersSynchronized(forceSync);
      this.applyMembers(members);
    } catch (err) {
      console.error('Erreur lors du chargement des membres:', err);
      this.toastService.showError('Membres', 'Erreur lors du chargement des membres');
    } finally {
      this.loading = false;
    }
  }

  private async handleSeasonChange(): Promise<void> {
    if (this.seasonRefreshInFlight) {
      this.pendingSeasonRefresh = true;
      return;
    }

    this.seasonRefreshInFlight = true;
    this.loading = true;

    try {
      do {
        this.pendingSeasonRefresh = false;
        await this.memberSyncService.ensureMembersSynchronized(true);
      } while (this.pendingSeasonRefresh);

      await this.refreshMembersAsync();
    } catch (err) {
      console.error('Erreur lors de la mise à jour saison des membres:', err);
      this.toastService.showError('Membres', 'Erreur lors de la mise à jour saison');
    } finally {
      this.loading = false;
      this.seasonRefreshInFlight = false;
    }
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
            email: newbee.email ?? '',
            phone_one: newbee.phone ?? '',
            license_taken_at: 'BCSTO',
            license_status: LicenseStatus.UNREGISTERED,
            accept_mailing: newbee.email ? true : false,
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

  getMemberStatus(member: Member): MemberStatus {
    return this.membersService.resolveMemberStatus(member);
  }

  private matchesStatusFilter(member: Member, filter: MemberStatus): boolean {
    if (filter === MemberStatus.NON_ADHERENT) {
      return !this.membersService.hasPaidMembership(member);
    }

    if (filter === MemberStatus.FFB_CLUB_ATTACHED) {
      return this.membersService.isFfbAttached(member);
    }

    if (filter === MemberStatus.OUTSIDE_FFB_CLUB) {
      return !this.membersService.isFfbAttached(member);
    }

    return this.getMemberStatus(member) === filter;
  }

  selectLifecycleFilter(filter: MemberLifecycleStatus): void {
    this.selectedLifecycleFilter = filter;
    this.selectedStatusFilter = null;
    this.applyStatusCounters();
    this.applyFilters();
  }

  filterOnStatus(filter: MemberStatus | null): void {
    this.selectedStatusFilter = filter;
    this.applyFilters();
  }

  private applyFilters(): void {
    this.filteredMembers = this.members
      .filter((member: Member) =>
        this.membersService.getLifecycleStatus(member) === this.selectedLifecycleFilter
        && (this.selectedStatusFilter === null || this.matchesStatusFilter(member, this.selectedStatusFilter))
      )
      .sort((a, b) => a.lastname.localeCompare(b.lastname, 'fr', { sensitivity: 'base' }));
  }

  getSelectedLifecycleLabel(): string {
    const labels: Record<MemberLifecycleStatus, string> = {
      ACTIVE: 'Actifs',
      ARCHIVED: 'Anciens',
      BANNED: 'Bannis',
    };
    return labels[this.selectedLifecycleFilter];
  }

  getStatusLabel(status: DirectoryFilter): string {
    return this.statusConfig[status].label;
  }

  getFilterIconClass(status: DirectoryFilter): string {
    return this.statusConfig[status].iconClass;
  }

  getMemberStatusIconClass(member: Member): string {
    const status = this.getMemberStatus(member);
    return this.getFilterIconClass(status === MemberStatus.NON_ADHERENT ? MemberStatus.OUTSIDE_FFB_CLUB : status);
  }

  isStatusWarning(member: Member): boolean {
    return !this.membersService.hasPaidMembership(member);
  }

  getMemberStatusTooltip(member: Member): string {
    const status = this.getMemberStatus(member);
    const membership = this.membersService.hasPaidMembership(member)
      ? 'Adhésion réglée pour la saison.'
      : 'Adhésion non enregistrée pour la saison.';

    if (status === MemberStatus.SYMPATHISANT) {
      if (!this.membersService.isLicensed(member)) {
        return `Sympathisant sans licence FFB active. ${membership}`;
      }
      const licenseLocation = member.license_taken_at ? ` au ${member.license_taken_at}` : '';
      const licenseDate = member.register_date ? ` le ${this.formatDate(member.register_date)}` : '';
      return `Sympathisant licencié${licenseLocation}${licenseDate}. ${membership}`;
    }

    if (status === MemberStatus.CLUB_LICENSEE) {
      return `Licence FFB rattachée au club. ${membership}`;
    }

    if (status === MemberStatus.OUTSIDE_FFB_CLUB || status === MemberStatus.NON_ADHERENT) {
      return `Absent de la base FFB du club. Sa situation de licence FFB ailleurs n’est pas connue. ${membership}`;
    }

    return this.getStatusLabel(status);
  }

  private formatDate(value: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
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
      email: personV2?.email ?? '',
      accept_mailing: personV2?.email ? true : false,
      phone_one: personV2?.phone ?? '',
      license_status: clubMember.licence ? LicenseStatus.DULY_REGISTERED : LicenseStatus.UNREGISTERED,
      license_taken_at: clubMember.club?.label ?? 'BCSTO',
      register_date: clubMember.mainRegistration?.createdAt ? clubMember.mainRegistration.createdAt.split('T')[0] : '',
      membership_date: '',
      person_id: clubMember.id,
      memberStatus: clubMember.licence ? 'CLUB_LICENSEE' : 'SYMPATHISANT',
      lifecycleStatus: 'ACTIVE',
      iv: undefined,
      iv_code: undefined,
    }
  }
  async archiveMember(member: Member): Promise<void> {
    if (!window.confirm(`Archiver ${this.membersService.full_name(member)} ?`)) return;
    await this.membersService.setLifecycleStatus(member, 'ARCHIVED', '', this.currentOperator());
    await this.refreshMembersAsync();
  }

  async banMember(member: Member): Promise<void> {
    const reason = window.prompt(`Motif du bannissement de ${this.membersService.full_name(member)} :`)?.trim();
    if (!reason) return;
    if (!window.confirm('Confirmer le bannissement ? La connexion et toute vente seront bloquées.')) return;
    await this.membersService.setLifecycleStatus(member, 'BANNED', reason, this.currentOperator());
    await this.refreshMembersAsync();
  }

  async restoreMember(member: Member): Promise<void> {
    if (!window.confirm(`Restaurer ${this.membersService.full_name(member)} comme membre actif ?`)) return;
    await this.membersService.setLifecycleStatus(member, 'ACTIVE', '', this.currentOperator());
    await this.refreshMembersAsync();
  }

  async unbanMember(member: Member): Promise<void> {
    if (!window.confirm(`Lever le bannissement de ${this.membersService.full_name(member)} ?`)) return;
    await this.membersService.setLifecycleStatus(member, 'ACTIVE', 'Bannissement levé', this.currentOperator());
    await this.refreshMembersAsync();
  }

  getLifecycleStatus(member: Member): MemberLifecycleStatus {
    return this.membersService.getLifecycleStatus(member);
  }

  private currentOperator(): string {
    const member = this.auth.currentMember;
    return member ? this.membersService.full_name(member) : 'administration';
  }

  private refreshMembers(): void {
    void this.refreshMembersAsync();
  }

  private async refreshMembersAsync(): Promise<void> {
    const members = await firstValueFrom(this.membersService.listMembers().pipe(take(1)));
    this.applyMembers(members ?? []);
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
