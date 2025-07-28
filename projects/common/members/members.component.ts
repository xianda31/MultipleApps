import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { MembersService } from './services/members.service';
import { LicenseesService } from '../licensees/services/licensees.service';
import { switchMap, tap } from 'rxjs';
import { FormControl, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule, UpperCasePipe } from '@angular/common';
import { NgbModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { GetNewbeeComponent } from '../modals/get-newbee/get-newbee.component';
import { InputPlayerComponent } from '../ffb/input-licensee/input-player.component';
import { FFBplayer } from '../ffb/interface/FFBplayer.interface';
import { FFB_licensee } from '../ffb/interface/licensee.interface';
import { Member, LicenseStatus } from '../member.interface';
import { SystemDataService } from '../services/system-data.service';
import { ToastService } from '../toaster/toast.service';

@Component({
  selector: 'app-members',
  encapsulation: ViewEncapsulation.None, // nécessaire pour que les CSS des tooltips fonctionnent
  imports: [FormsModule, CommonModule, ReactiveFormsModule, UpperCasePipe, InputPlayerComponent, NgbTooltipModule],
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
    'registered': 'Déclaré à la FFB',
    'unregistered': 'Non déclaré à la FFB',
    'all': 'Tout le répertoire BCSTO',
    // 'offered': 'Offerte',
  };


  
  selection: string = '';

  radioButtonGroup: FormGroup = new FormGroup({
    radioButton: new FormControl('Tous')
  });

  constructor(
    private licenseesService: LicenseesService,
    private membersService: MembersService,
    private sysConfService: SystemDataService,
    private modalService: NgbModal,
    private toastService: ToastService

  ) {
  }

  ngOnInit(): void {
    this.radioButtonGroup.valueChanges.subscribe(() => {
      this.onSelectLicence(this.radioButtonGroup.value.radioButton);
    });

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
      // take(1),
      tap((members) => {
        this.members = members;
        this.reset_license_statuses();
      }),
    ).subscribe(() => {
      this.updateDBfromFFB();
      this.filteredMembers = this.members;
      // console.log(this.members);
    });
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
      }else{
      }
    }
  }


  onSelectLicence(status: string) {
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
      }else{
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
        verbose += `\n${key} changed from ${is[key]} to ${next[key]}`;
      }
    }

    if(diff) {
      console.log('Member %s %s has changed', member.lastname, member.firstname, verbose);
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

}

