import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { MembersService, MemberStatus } from '../../common/services/members.service';
import { Observable, Subject, distinctUntilKeyChanged, firstValueFrom, skip, take, takeUntil } from 'rxjs';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule, UpperCasePipe } from '@angular/common';
import { NgbModal, NgbTooltipModule, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { GetNewbeeComponent, NewMemberFormValue } from '../modals/get-newbee/get-newbee.component';
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
import { activeMembersCsvFileName, buildActiveMembersCsv } from './active-members-csv.util';
import { GroupService } from '../authentification/group.service';
import { Group_priorities } from '../authentification/group.interface';
import { getFfbRankingCodeParts } from '../utils/ffb-ranking.util';
import {
  MemberMergeConflictModalComponent,
  MemberMergeDecision,
} from './member-merge-conflict-modal.component';
import {
  FfbMemberCreationDecision,
  FfbMemberCreationModalComponent,
} from './ffb-member-creation-modal.component';
import { ManualMemberDuplicateModalComponent } from './manual-member-duplicate-modal.component';
import { hasSameNormalizedNames } from '../services/member-identity.util';
import { normalizeMemberEmail } from '../services/member-email.util';

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
  private readonly defaultInfoColumns = ['license_number', 'membership_date', 'register_date', 'email', 'birthdate', 'phone_one', 'city', 'accept_mailing'];
  infoColumns = [...this.defaultInfoColumns];
  infoColumnLabels: { [key: string]: string } = {
    license_number: 'Licence',
    membership_date: "Date d'adhésion",
    register_date: "Date de licence",
    email: 'Mail',
    birthdate: 'Date naissance',
    phone_one: 'Téléphone',
    city: 'Ville',
    accept_mailing: 'Accepte mails',
    lifecycleReason: 'Raison',
  };
  selectedInfoColumn: string = 'membership_date';
  private readonly destroy$ = new Subject<void>();
  private seasonRefreshInFlight = false;
  private pendingSeasonRefresh = false;
  canDeleteMembers = false;

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
    private groupService: GroupService,
  ) {
  }

  ngOnInit(): void {
    this.loading = true;
    void this.groupService.getUserAccreditation()
      .then(accreditation => {
        this.canDeleteMembers = accreditation.level >= Group_priorities.Administrateur;
      })
      .catch(() => {
        this.canDeleteMembers = false;
      });
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
      const changed = await this.resolveMemberMergeConflicts();
      if (changed) {
        await this.refreshMembersAsync();
      } else {
        this.applyMembers(members);
      }
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
        await this.resolveMemberMergeConflicts();
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

    this.new_player = null as any;
    const existingMember = this.members.find((member) =>
      member.person_id === player.id
      || member.license_number?.trim() === player.license_number?.trim()
    );
    if (existingMember) {
      this.toastService.showWarning(
        'Personne déjà présente',
        `${existingMember.firstname} ${existingMember.lastname} existe déjà dans le répertoire`
      );
      return;
    }

    try {
      const personV2 = await this.ffbService.getFFBPerson(player.id).catch(() => null);
      const candidates = this.members.filter((member) => hasSameNormalizedNames(
        member.firstname,
        member.lastname,
        player.firstName,
        player.lastName,
      ));

      if (candidates.length > 0) {
        const conflict = { clubMember: player, person: personV2, candidates };
        const modalRef = this.modalService.open(MemberMergeConflictModalComponent, {
          size: 'lg',
          centered: true,
          backdrop: 'static',
          keyboard: false,
        });
        modalRef.componentInstance.conflict = conflict;
        const decision = await modalRef.result.catch(() => ({ action: 'defer' } as MemberMergeDecision));

        if (decision.action === 'merge') {
          await this.memberSyncService.mergeMemberConflict(conflict, decision.memberId);
          this.toastService.showSuccess(
            'Rapprochement FFB',
            `${player.firstName} ${player.lastName} a été fusionné avec la fiche existante`
          );
          await this.refreshMembersAsync();
          return;
        }
        if (decision.action !== 'create') return;
      }

      const modalRef = this.modalService.open(FfbMemberCreationModalComponent, {
        centered: true,
        backdrop: 'static',
        keyboard: false,
      });
      modalRef.componentInstance.clubMember = player;
      modalRef.componentInstance.person = personV2;
      const creation = await modalRef.result.catch(() => null) as FfbMemberCreationDecision | null;
      if (!creation) return;

      const email = await this.validateCreationEmail(creation.email);
      if (!email) return;

      const newMember: Member = {
        ...this.createNewMember(player, personV2),
        email,
        accept_mailing: creation.acceptMailing,
      };
      await this.memberSyncService.createMemberWithComputedStatus(newMember);
      await this.refreshMembersAsync();
    } catch (error) {
      console.error('Erreur lors de l’ajout d’une personne FFB:', error);
      this.toastService.showError('Ajout FFB', 'La personne n’a pas pu être ajoutée au répertoire');
    }
  }

  async addNewbee(): Promise<void> {
    const modalRef = this.modalService.open(GetNewbeeComponent, { centered: true });
    const newbee = await modalRef.result.catch(() => null) as NewMemberFormValue | null;
    if (!newbee) return;

    const email = await this.validateCreationEmail(newbee.email);
    if (!email) return;

    const candidates = this.members.filter((member) => hasSameNormalizedNames(
      member.firstname,
      member.lastname,
      newbee.firstname,
      newbee.lastname,
    ));
    if (candidates.length > 0) {
      const duplicateModal = this.modalService.open(ManualMemberDuplicateModalComponent, {
        size: 'lg',
        centered: true,
        backdrop: 'static',
        keyboard: false,
      });
      duplicateModal.componentInstance.firstName = newbee.firstname;
      duplicateModal.componentInstance.lastName = newbee.lastname;
      duplicateModal.componentInstance.candidates = candidates;
      const createDistinct = await duplicateModal.result.catch(() => false);
      if (!createDistinct) return;
    }

    const newMember: Member = {
      id: '',
      gender: normalizeGender(newbee.gender),
      firstname: newbee.firstname.trim(),
      lastname: newbee.lastname.trim().toUpperCase(),
      license_number: this.createProvisionalLicense(newbee.lastname, newbee.firstname),
      birthdate: '',
      city: this.capitalizeFirst(newbee.city.trim()),
      email,
      phone_one: newbee.phone.trim(),
      license_taken_at: 'BCSTO',
      license_status: LicenseStatus.UNREGISTERED,
      accept_mailing: newbee.acceptMailing,
      membership_date: '',
      memberStatus: 'NON_ADHERENT',
      person_id: undefined,
      iv: undefined
    };

    try {
      await this.memberSyncService.createMemberWithComputedStatus(newMember);
      this.toastService.showSuccess(
        'Nouveau membre non licencié',
        `${newMember.lastname} ${newMember.firstname}`
      );
      await this.refreshMembersAsync();
    } catch (error) {
      console.error('Erreur lors de la création d’une personne non licenciée:', error);
      this.toastService.showError('Nouveau membre', 'La personne n’a pas pu être créée');
    }
  }

  private async validateCreationEmail(value: string): Promise<string | null> {
    const email = normalizeMemberEmail(value);
    if (!email) {
      this.toastService.showWarning('Email obligatoire', 'Une adresse email est nécessaire pour créer la fiche');
      return null;
    }

    try {
      const existingMember = await this.membersService.searchMemberByEmail(email);
      if (!existingMember) return email;

      this.toastService.showWarning(
        'Email déjà utilisé',
        `${email} est déjà associé à ${existingMember.firstname} ${existingMember.lastname}`
      );
      return null;
    } catch (error) {
      console.error('Erreur lors du contrôle d’unicité de l’email:', error);
      this.toastService.showError(
        'Contrôle de l’email',
        'Impossible de vérifier cette adresse ; création annulée'
      );
      return null;
    }
  }

  private createProvisionalLicense(lastName: string, firstName: string): string {
    const base = '??' + lastName.trim().toUpperCase().slice(0, 3) + firstName.trim().slice(0, 3);
    const existingLicenses = new Set(this.members.map((member) => member.license_number));
    if (!existingLicenses.has(base)) return base;

    for (let index = 1; index < 1296; index++) {
      const suffix = index.toString(36).toUpperCase().padStart(2, '0');
      const candidate = base.slice(0, 6).padEnd(6, 'X') + suffix;
      if (!existingLicenses.has(candidate)) return candidate;
    }

    throw new Error(`Impossible de générer un identifiant provisoire unique pour ${firstName} ${lastName}`);
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
    this.infoColumns = filter === 'BANNED'
      ? ['lifecycleReason', ...this.defaultInfoColumns]
      : [...this.defaultInfoColumns];
    if (filter === 'BANNED') {
      this.selectedInfoColumn = 'lifecycleReason';
    } else if (this.selectedInfoColumn === 'lifecycleReason') {
      this.selectedInfoColumn = 'membership_date';
    }
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

  exportActiveMembersCsv(): void {
    const csv = buildActiveMembersCsv(this.members);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = activeMembersCsvFileName();
    anchor.click();
    URL.revokeObjectURL(url);
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

  async deleteBannedMember(member: Member): Promise<void> {
    if (!this.canDeleteMembers || this.getLifecycleStatus(member) !== 'BANNED') return;

    const confirmed = window.confirm(
      `Supprimer définitivement la fiche de ${this.membersService.full_name(member)} ?\n\n` +
      `Cette action est irréversible. L’historique comptable sera conservé. ` +
      `Le compte de connexion éventuel devra être supprimé séparément dans Droits d’accès.`
    );
    if (!confirmed) return;

    await this.membersService.deleteMember(member);
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

  private async resolveMemberMergeConflicts(): Promise<boolean> {
    let changed = false;
    for (const conflict of this.memberSyncService.getPendingMergeConflicts()) {
      const modalRef = this.modalService.open(MemberMergeConflictModalComponent, {
        size: 'lg',
        centered: true,
        backdrop: 'static',
        keyboard: false,
      });
      modalRef.componentInstance.conflict = conflict;

      const decision = await modalRef.result as MemberMergeDecision;
      if (decision.action === 'merge') {
        await this.memberSyncService.mergeMemberConflict(conflict, decision.memberId);
        this.toastService.showSuccess(
          'Rapprochement FFB',
          `${conflict.clubMember.firstName} ${conflict.clubMember.lastName} a été fusionné avec la fiche existante`
        );
        changed = true;
      } else if (decision.action === 'create') {
        await this.memberSyncService.createDistinctMember(conflict);
        this.toastService.showSuccess(
          'Rapprochement FFB',
          `${conflict.clubMember.firstName} ${conflict.clubMember.lastName} a été créé comme personne distincte`
        );
        changed = true;
      }
    }
    return changed;
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
    return getFfbRankingCodeParts(this.getIvCode(iv));
  }

}
