import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { MembersService } from '../../common/services/members.service';
import { LicenseesService } from '../../common/services/licensees.service';
import { Observable, switchMap, tap, take, filter, firstValueFrom } from 'rxjs';
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
import { BookService } from '../../back/services/book.service';
import { Revenue } from '../interfaces/accounting.interface';
import { FFB_proxyService } from '../ffb/services/ffb.service';
import { PersonV2 } from '../ffb/interface/person-v2.interface';


enum FILTER {
  'MEMBER' = 'membre',
  'MEMBER_AT_FFB' = 'membre licencié à la FFB',
  'STUDENT' = 'membre sans licence',
  'UNKNOWN' = 'non adhérent',
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
  licensees: ClubMember[] = [];
  sympatisants_number: number = 0;
  no_license_nbr: number = 0;
  lost_members_nbr: number = 0;
  new_player!: ClubMember;
  season: string = '';
  operations: Revenue[] = [];
  FILTERS = FILTER;
  filters = Object.values(FILTER);
  selected_filter: FILTER = FILTER.MEMBER;
  filter_icons: { [key in FILTER]: string } = {
    [FILTER.MEMBER]: 'bi bi-person-check-fill',
    [FILTER.MEMBER_AT_FFB]: 'bi bi-person-badge-fill',
    [FILTER.STUDENT]: 'bi bi-mortarboard-fill',
    [FILTER.UNKNOWN]: 'bi bi-person-slash',
  };
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
    private licenseesService: LicenseesService,
    private membersService: MembersService,
    private memberSettingsService: MemberSettingsService,
    private sysConfService: SystemDataService,
    private modalService: NgbModal,
    private toastService: ToastService,
    private bookService: BookService,
    private ffbService: FFB_proxyService,
  ) {
  }

  ngOnInit(): void {

    let today = new Date();
    this.season = this.sysConfService.get_season(today);

    this.loading = true;
    this.bookService.list_book_entries().pipe(
      filter(() => this.bookService.is_book_entries_loaded()),
      tap(() => {
        this.operations = this.bookService.get_operations();
      }),
      switchMap(() => this.licenseesService.getClubMembers$()),
      tap((licensees) => {
        this.licensees = licensees;
        this.sympatisants_number = this.licensees.reduce((count, clubMember) => {
          return count + (!clubMember.licence ? 1 : 0);
        }, 0);
      }),
      switchMap(() => this.membersService.listMembers()),
      take(1)
    ).subscribe({
      next: (members: Member[]) => {
        this.members = members.sort((a, b) => a.lastname.localeCompare(b.lastname, 'fr', { sensitivity: 'base' }));
        this.avatar_urls$ = this.collect_avatars(this.members);
        this.filterOnStatus(this.selected_filter);
        // console.log(this.members);

        // Enchaînement déterministe pour éviter les écritures concurrentes sur membership_date.
        void (async () => {
          await this.updateDBfromFFB();
          await this.refreshMembersAsync();
          await this.reset_license_statuses();
          await this.check_membership_paied();
          this.filterOnStatus(this.selected_filter);
          // update_iv() removed: Ranking now provides iv directly
        })()
          .catch(err => console.error('Erreur lors du traitement des membres:', err))
          .finally(() => {
            this.loading = false;
          });
      },
      error: () => { this.loading = false; this.toastService.showError('Membres', 'Erreur lors du chargement des membres'); },
    });
  }


  collect_avatars(members: Member[]): { [key: string]: Observable<string> } {
    const avatarUrls: { [key: string]: Observable<string> } = {};
    members.forEach((member: Member) => {
      avatarUrls[member.license_number] = this.memberSettingsService.getAvatarUrl(member);
    });
    return avatarUrls;
  }

  async check_membership_paied() {
    const updates: Promise<any>[] = [];
    this.members.forEach((member) => {
      const full_name = this.membersService.full_name(member);
      const buy_op = this.operations.filter((op) => op.member === full_name);
      const hasAdh = buy_op.find(op => 'ADH' in op.values);

      const newMembershipDate = hasAdh ? hasAdh.date : '';

      // Vérifier si le changement est réel avant d'updater
      if (member.membership_date !== newMembershipDate) {
        member.membership_date = newMembershipDate;
        updates.push(this.membersService.updateMember(member));
      }
    });
    await Promise.all(updates);
    this.no_license_nbr = this.members.filter(m => m.membership_date && (m.license_status === LicenseStatus.UNREGISTERED)).length;
    this.lost_members_nbr = this.members.filter(m => !m.membership_date && (m.license_status === LicenseStatus.UNREGISTERED)).length;
  }

  async add_licensee(player: ClubMember) {
    if (!player) { return; }

    const personV2 = await this.ffbService.getFFBPerson(player.id).catch(() => null);
    const new_member: Member = this.createNewMember(player, personV2);
    console.log('Ajout d\'un nouveau membre :', new_member);
    this.membersService.createMember(new_member).then(() => {
      this.refreshMembers();
      this.new_player = null as any;
    });
  }

  add_newbee() {
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
            gender: newbee.gender === 1 ? 'M' : 'F',
            firstname: newbee.firstname,
            lastname: newbee.lastname.toUpperCase(),
            license_number: '??' + newbee.lastname.toUpperCase().slice(0, 3) + newbee.firstname.slice(0, 3),
            birthdate: newbee.birthdate,
            city: this.capitalize_first(newbee.city.toLowerCase()),
            season: '',
            email: newbee.email ?? '',
            phone_one: newbee.phone ?? '',
            license_taken_at: 'BCSTO',
            license_status: LicenseStatus.UNREGISTERED,
            is_sympathisant: false,
            accept_mailing: newbee.email ? true : false,
            has_avatar: false,
            membership_date: '',
            person_id: undefined,
            iv: undefined
          }
          this.membersService.createMember(new_member).then((_member) => {
            this.toastService.showSuccess('Nouveau membre non licencié', new_member.lastname + ' ' + new_member.firstname);
            this.refreshMembers();
          });
        });
      }

    });
  }

  capitalize_first(str: string | undefined): string {
    if (!str) return '';
    str = str.replace(/^(\w)(.+)/, (match, p1, p2) => p1.toUpperCase() + p2.toLowerCase())
    return str;
  }

  async reset_license_statuses() {
    const updates: Promise<any>[] = [];
    for (const member of this.members) {
      const existsInFFB = this.licensees.some((l) => l.id === member.person_id);

      // Reset la licence seulement si elle n'existe pas dans FFB et n'est pas déjà UNREGISTERED
      if (!existsInFFB && member.license_status !== LicenseStatus.UNREGISTERED) {
        member.license_status = LicenseStatus.UNREGISTERED;
        updates.push(this.membersService.updateMember(member));
        this.toastService.showWarning('Licences', `Licence de ${member.lastname} ${member.firstname} obsolète `);
      }
    }
    await Promise.all(updates);
  }


  filterOnStatus(filter: FILTER) {
    this.selected_filter = filter;
    this.filteredMembers = this.members.filter((member: Member) => {
      switch (filter) {
        case FILTER.MEMBER_AT_FFB: //'membre licencié':
          return ((member.license_status === LicenseStatus.DULY_REGISTERED || member.license_status === LicenseStatus.PROMOTED_ONLY));
        case FILTER.STUDENT: //'membre sans licence':
          return (member.membership_date && (member.license_status === LicenseStatus.UNREGISTERED));
        case FILTER.MEMBER: //'membre (i.e. adhérent ou déclaré à la FFB)':
          return (member.membership_date || (member.license_status === LicenseStatus.DULY_REGISTERED || member.license_status === LicenseStatus.PROMOTED_ONLY));
        case FILTER.UNKNOWN: //'non adhérent':
          return (!member.membership_date && (member.license_status === LicenseStatus.UNREGISTERED));

        default: //'Tous':
          throw new Error('Filtre inconnu' + filter);
      }
    }).sort((a, b) => a.lastname.localeCompare(b.lastname, 'fr', { sensitivity: 'base' }));
  }


  async updateDBfromFFB() {
    const updates: Promise<any>[] = [];
    this.licensees.forEach((licensee) => {
      updates.push(this.createOrUpdateMember(licensee));
    });
    await Promise.all(updates);
    // Retrier et refilter après les mises à jour FFB
    this.members.sort((a, b) => a.lastname.localeCompare(b.lastname, 'fr', { sensitivity: 'base' }));
    this.filterOnStatus(this.selected_filter);
  }

  async createOrUpdateMember(clubMember: ClubMember) {
    const existingMember = this.members.find((m) => m.license_number === clubMember.license_number);

    if (existingMember) {
      const updatedMember = this.compare(existingMember, clubMember, clubMember.license_number);
      // Seulement updater si compare() détecte des changements (retourne non-null)
      if (updatedMember !== null) {
        await this.membersService.updateMember(updatedMember);
      }
    } else {
      // Nouveau membre : enrichir avec PersonV2 (email, tél., ville)
      const personV2 = await this.ffbService.getFFBPerson(clubMember.id).catch(() => null);
      const newMember = this.createNewMember(clubMember, personV2);
      await this.membersService.createMember(newMember);
    }
  }


  compare(member: Member, clubMember: ClubMember, ffbIdPadded: string): Member | null {

    let nextMember: Member = {
      id: member.id,
      license_number: ffbIdPadded,
      gender: clubMember.gender,
      firstname: clubMember.firstName,
      lastname: clubMember.lastName.toUpperCase(),
      birthdate: clubMember.birthdate,
      city: member.city,
      season: clubMember.licence ? this.season : '',
      email: member.email,
      phone_one: member.phone_one,
      license_taken_at: clubMember.club?.label ?? 'BCSTO',
      register_date: clubMember.mainRegistration?.createdAt ? clubMember.mainRegistration.createdAt.split('T')[0] : '',
      license_status: clubMember.licence ? LicenseStatus.DULY_REGISTERED : LicenseStatus.UNREGISTERED,
      is_sympathisant: !clubMember.licence,
      accept_mailing: member.accept_mailing,
      has_avatar: member.has_avatar,
      membership_date: member.membership_date,
      person_id: clubMember.id,
      iv: clubMember.season?.ranking?.iv,
      // iv_code: this.membersService.iv_code(clubMember.season?.ranking?.iv ?? 0),
    }
    let is: { [key: string]: any } = member;
    let next: { [key: string]: any } = nextMember;
    let diff: boolean = false;
    let verbose = '';
    for (let key in next) {
      if (next[key] !== is[key]) {
        diff = true;
        verbose += `\n${key} est passé de ${is[key]} à ${next[key]}`;
      }
    }

    if (diff) {
      console.log('%s %s a changé ses données : %s', member.lastname, member.firstname, verbose);
      this.toastService.showInfo(`Fiche de ${member.lastname} ${member.firstname}`, `${verbose}`);
    }
    return diff ? nextMember : null;
  }

  createNewMember(clubMember: ClubMember, personV2: PersonV2 | null): Member {
    return {
      id: '',
      gender: clubMember.gender,
      firstname: clubMember.firstName,
      lastname: clubMember.lastName.toUpperCase(),
      license_number: clubMember.license_number,
      birthdate: clubMember.birthdate,
      city: personV2?.city ?? '',
      season: clubMember.licence ? this.season : '',
      email: personV2?.email ?? '',
      accept_mailing: personV2?.email ? true : false,
      phone_one: personV2?.phone ?? '',
      is_sympathisant: !clubMember.licence,
      license_status: clubMember.licence ? LicenseStatus.DULY_REGISTERED : LicenseStatus.UNREGISTERED,
      license_taken_at: clubMember.club?.label ?? 'BCSTO',
      register_date: clubMember.mainRegistration?.createdAt ? clubMember.mainRegistration.createdAt.split('T')[0] : '',
      membership_date: '',
      has_avatar: false,
      person_id: clubMember.id,
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
    this.avatar_urls$ = this.collect_avatars(this.members);
    this.filterOnStatus(this.selected_filter);
  }

  access_settings(member: Member): void {
    this.memberSettingsService.access_settings(member).subscribe((settings_changed) => {
      if (settings_changed) {
        // this.toastService.showSuccess(`Préférences de ${this.membersService.full_name(member)}`, 'Mise à jour effectuée');
      }
    });
  }

  get_iv_code(iv: number | undefined): string {
    if (iv === undefined) return '';
    return this.membersService.iv_code(iv);
  }

  /**
   * Parse IV code into series and symbol parts for display
   * Only card suits (♥, ♦, ♣, ♠) are colored/bold, not series or SA/N
   * Examples: "4♥" → {series: "4", suit: "♥", suitColor: "#d32f2f", tail: ""}
   *           "4SA" → {series: "4", suit: "", suitColor: "#000", tail: "SA"}
   */
  get_iv_code_parts(iv: number | undefined): { series: string; suit: string; suitColor: string; tail: string } {
    const code = this.get_iv_code(iv);
    
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
