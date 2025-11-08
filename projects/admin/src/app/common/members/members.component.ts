import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { MembersService } from '../../common/services/members.service';
import { LicenseesService } from '../licensees/services/licensees.service';
import { Observable, switchMap, tap } from 'rxjs';
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

@Component({
  selector: 'app-members',
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
  new_player!: FFBplayer;
  season: string = '';

  // selected_filter: string = 'Tous';
  licenses_status: { [key: string]: string } = {
    'registered': 'reg. FFB',
    'unregistered': 'autres',
    // 'all': 'tous',
    // 'offered': 'Offerte',
  };
  selected_status: string = 'registered';

    avatar_urls$: { [key: string]: Observable<string> } = {};

  // radioButtonGroup: FormGroup = new FormGroup({
  //   radioButton: new FormControl('Tous')
  // });

  constructor(
    private licenseesService: LicenseesService,
    private membersService: MembersService,
    private memberSettingsService: MemberSettingsService, 
    private sysConfService: SystemDataService,
    private modalService: NgbModal,
    private toastService: ToastService

  ) {
  }

  ngOnInit(): void {

    let today = new Date();
    this.season = this.sysConfService.get_season(today);


    this.licenseesService.list_FFB_licensees$().pipe(
      tap((licensees) => {
        this.licensees = licensees;
        this.sympatisants_number = this.licensees.reduce((count, licensee) => {
          return count + (licensee.is_sympathisant ? 1 : 0);
        }, 0);
      }),
      switchMap(() => this.membersService.listMembers()),

    ).subscribe((members) => {
      this.members = members;
      this.avatar_urls$ = this.collect_avatars(members);
      this.reset_license_statuses();
      this.updateDBfromFFB();
      this.filterOnStatus(this.selected_status);
      // console.log(this.members);
    });
  }

  collect_avatars(members : Member[]): { [key: string]: Observable<string> } {
    const avatarUrls: { [key: string]: Observable<string> } = {};
    members.forEach((member: Member) => {
      avatarUrls[member.license_number] = this.memberSettingsService.getAvatarUrl(member);
    });
    return avatarUrls;
  }


  add_licensee(player: FFBplayer) {
    if (player) {
      const new_member: Member = this.player2member(player);
      this.membersService.createMember(new_member);
    }
  }

  add_newbee() {
    const modalRef = this.modalService.open(GetNewbeeComponent, { centered: true });

    modalRef.result.then((newbee: any) => {
      if (newbee) {
        let new_member: Member = {
          id: '',
          gender: newbee.gender,
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
        }
        this.membersService.createMember(new_member).then((_member) => {
          this.toastService.showSuccess('Nouveau membre non licencié', new_member.lastname + ' ' + new_member.firstname);
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
    }
  }

  updateDBfromFFB() {
    this.licensees.forEach((licensee) => {
      this.createOrUpdateMember(licensee);
    });
  }

  async reset_license_statuses() {
    for (const member of this.members) {
      if (!this.licensees.some((l) => l.license_number === member.license_number)) {
        if (member.license_status !== LicenseStatus.UNREGISTERED) {
          member.license_status = LicenseStatus.UNREGISTERED;
          this.membersService.updateMember(member);
          this.toastService.showWarning('Licences', `Licence de ${member.lastname} ${member.firstname} obsolète `);
        }
      } else {
      }
    }
  }


  filterOnStatus(status: string) {
    this.selected_status = status;
    this.filteredMembers = this.members.filter((member: Member) => {
      switch (status) {
        case "registered": //'à jour':
          return (member.license_status === LicenseStatus.DULY_REGISTERED || member.license_status === LicenseStatus.PROMOTED_ONLY);
        case "unregistered": //'non à jour':
          return (member.license_status === LicenseStatus.UNREGISTERED);
        case "all": //'Tous':
        default: //'Tous':
          return true;
      }
    });
  }

  async createOrUpdateMember(licensee: FFB_licensee) {
    let existingMember = this.members.find((m) => m.license_number === licensee.license_number);

    if (existingMember) {
      let member = this.compare(existingMember, licensee);
      if (member !== null) {
        // this.verbose += 'modification : ' + member.lastname + ' ' + member.firstname + '\n';
        await this.membersService.updateMember(member);
      } else {
      }

    } else {
      let newMember = this.createNewMember(licensee);
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
      phone_one: licensee.phone_one,
      is_sympathisant: licensee.is_sympathisant ?? false,
      license_status: licensee.register ? (licensee.license_id ? LicenseStatus.DULY_REGISTERED : LicenseStatus.PROMOTED_ONLY) : LicenseStatus.UNREGISTERED,
      license_taken_at: licensee.orga_license_name ?? 'BCSTO',
    }

  }
  deleteMember(member: Member) {
    this.membersService.deleteMember(member);
  }

  access_settings(member: Member): void {
    this.memberSettingsService.access_settings(member).subscribe((settings_changed) => {
      if (settings_changed) {
        // this.toastService.showSuccess(`Préférences de ${this.membersService.full_name(member)}`, 'Mise à jour effectuée');
      }
    });
  }

}
