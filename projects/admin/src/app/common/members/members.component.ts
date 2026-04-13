import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { MembersService } from '../../common/services/members.service';
import { LicenseesService } from '../licensees/services/licensees.service';
import { Observable, switchMap, tap, take } from 'rxjs';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule, UpperCasePipe } from '@angular/common';
import { NgbModal, NgbTooltipModule, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { GetNewbeeComponent } from '../modals/get-newbee/get-newbee.component';
import { InputPlayerComponent } from '../ffb/input-licensee/input-player.component';
import { FFBplayer } from '../ffb/interface/FFBplayer.interface';
import { FFB_licensee } from '../ffb/interface/licensee.interface';
import { Member, LicenseStatus } from '../interfaces/member.interface';
import { SystemDataService } from '../services/system-data.service';
import { ToastService } from '../services/toast.service';
import { PhonePipe } from '../pipes/phone.pipe';
import { MemberSettingsService } from '../services/member-settings.service';
import { BookService } from '../../back/services/book.service';
import { Revenue } from '../interfaces/accounting.interface';
import { FFBPersonIV } from '../interfaces/FFBperson.interface';


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
  licensees: FFB_licensee[] = [];
  sympatisants_number: number = 0;
  no_license_nbr: number = 0;
  lost_members_nbr: number = 0;
  new_player!: FFBplayer;
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

  ) {
  }

  ngOnInit(): void {

    let today = new Date();
    this.season = this.sysConfService.get_season(today);

    this.loading = true;
    this.bookService.list_book_entries().pipe(
      tap(() => {
        this.operations = this.bookService.get_operations();
      }),
      switchMap(() => this.licenseesService.list_FFB_licensees$()),
      tap((licensees) => {
        this.licensees = licensees;
        this.sympatisants_number = this.licensees.reduce((count, licensee) => {
          return count + (licensee.is_sympathisant ? 1 : 0);
        }, 0);
      }),
      switchMap(() => this.membersService.listMembers()),
      take(1)
    ).subscribe({
      next: (members: Member[]) => {
        this.members = members;
        this.avatar_urls$ = this.collect_avatars(members);
        this.filterOnStatus(this.selected_filter);
        this.loading = false;
        // console.log(this.members);

        // Lancer les checks en parallèle en arrière-plan (sans bloquer l'affichage)
        Promise.all([
          this.check_membership_paied(),
          this.reset_license_statuses(),
          this.updateDBfromFFB(),
          this.update_iv()
        ]).catch(err => console.error('Erreur lors du traitement des membres:', err));
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

  add_licensee(player: FFBplayer) {
    if (player) {
      const new_member: Member = this.player2member(player);
      this.membersService.createMember(new_member).then(() => {
        this.refreshMembers();
        this.new_player = null as any;
      });
    }
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
            gender: newbee.gender=== 1 ? 'M.' : 'Mme',
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

  player2member(player: FFBplayer): Member {

    return {
      id: '',
      gender: player.gender === 1 ? 'M.' : 'Mme',
      firstname: player.firstname,
      lastname: player.lastname.toUpperCase(),
      license_number: player.license_number,
      birthdate: player.birthdate,
      city: this.capitalize_first(player.city.toLowerCase()),
      season: player.last_season,
      email: '?',
      phone_one: '?',
      license_taken_at: player.last_club ?? '??',
      // register_date: ''
      license_status: player.is_current_season ? LicenseStatus.DULY_REGISTERED : LicenseStatus.UNREGISTERED,
      is_sympathisant: false,
      accept_mailing: true,
      has_avatar: false,
      membership_date: '',
      person_id: player.person_id
    }
  }

  async update_iv() {
    const updates: Promise<any>[] = [];

    for (const member of this.members) {
      if (member.iv == null && member.person_id !== undefined && member.person_id !== null) {
        const iv : FFBPersonIV | undefined = await this.licenseesService.get_iv(member.person_id);
        if (iv !== undefined) {
          console.log(`Mise à jour de l'iv pour ${member.lastname} ${member.firstname} (person_id: ${member.person_id}) (iv: ${iv.iv}, code: ${iv.code})`);
          member.iv = iv.iv;
          member.iv_code = iv.code;
          updates.push(this.membersService.updateMember(member));
        }
      }
    }
    await Promise.all(updates);
  }

  async reset_license_statuses() {
    const updates: Promise<any>[] = [];
    for (const member of this.members) {
      const existsInFFB = this.licensees.some((l) => l.license_number === member.license_number);

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
    });
  }


  async updateDBfromFFB() {
    const updates: Promise<any>[] = [];
    this.licensees.forEach((licensee) => {
      updates.push(this.createOrUpdateMember(licensee));
    });
    await Promise.all(updates);
  }

  async createOrUpdateMember(licensee: FFB_licensee) {
    const existingMember = this.members.find((m) => m.license_number === licensee.license_number);

    if (existingMember) {
      const updatedMember = this.compare(existingMember, licensee);
      // Seulement updater si compare() détecte des changements (retourne non-null)
      if (updatedMember !== null) {
        await this.membersService.updateMember(updatedMember);
      }
    } else {
      // Créer nouveau membre seulement s'il n'existe pas
      const newMember = this.createNewMember(licensee);
      await this.membersService.createMember(newMember);
    }
  }


  compare(member: Member, licensee: FFB_licensee): Member | null {

    let nextMember: Member = {
      id: member.id,
      license_number: licensee.license_number,
      gender: licensee.gender,
      firstname: licensee.firstname,
      lastname: licensee.lastname.toUpperCase(),
      birthdate: licensee.birthdate,
      city: this.capitalize_first(licensee.city?.toLowerCase()),
      season: (licensee.season || licensee.license_id) ? this.season : '',
      email: licensee.email?.trim().toLowerCase() ?? '',
      phone_one: licensee.phone_one,
      license_taken_at: licensee.orga_license_name ?? 'BCSTO',
      register_date: licensee.register_date ?? '',
      license_status: licensee.register ? (licensee.license_id ? LicenseStatus.DULY_REGISTERED : LicenseStatus.PROMOTED_ONLY) : LicenseStatus.UNREGISTERED,
      is_sympathisant: licensee.is_sympathisant ?? false,
      accept_mailing: member.accept_mailing,
      has_avatar: member.has_avatar,
      membership_date: member.membership_date,
      person_id: licensee.person_id ?? member.person_id,

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

  createNewMember(licensee: FFB_licensee): Member {
    return {
      id: '',
      gender: licensee.gender,
      firstname: licensee.firstname,
      lastname: licensee.lastname.toUpperCase(),
      license_number: licensee.license_number,
      birthdate: licensee.birthdate,
      city: this.capitalize_first(licensee.city?.toLowerCase()),
      season: licensee.season ?? (licensee.register ? this.season : ''),
      email: licensee.email ?? '',
      accept_mailing: licensee.email ? true : false,
      phone_one: licensee.phone_one,
      is_sympathisant: licensee.is_sympathisant ?? false,
      license_status: licensee.register ? (licensee.license_id ? LicenseStatus.DULY_REGISTERED : LicenseStatus.PROMOTED_ONLY) : LicenseStatus.UNREGISTERED,
      license_taken_at: licensee.orga_license_name ?? 'BCSTO',
      register_date: licensee.register_date ?? '',
      membership_date: '',
      has_avatar: false,
      person_id: licensee.person_id ?? undefined,
    }
  }
  deleteMember(member: Member) {
    this.membersService.deleteMember(member).then(() => {
      this.refreshMembers();
    });
  }

  private refreshMembers(): void {
    this.membersService.listMembers().pipe(take(1)).subscribe((members: Member[]) => {
      this.members = members;
      this.avatar_urls$ = this.collect_avatars(members);
      this.filterOnStatus(this.selected_filter);
    });
  }

  access_settings(member: Member): void {
    this.memberSettingsService.access_settings(member).subscribe((settings_changed) => {
      if (settings_changed) {
        // this.toastService.showSuccess(`Préférences de ${this.membersService.full_name(member)}`, 'Mise à jour effectuée');
      }
    });
  }

}
