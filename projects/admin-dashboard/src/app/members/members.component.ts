import { Component, OnInit } from '@angular/core';
import { MembersService } from './service/members.service';
import { LicenseesService } from '../licensees/services/licensees.service';
import { combineLatest } from 'rxjs';
import { Member } from '../../../../common/member.interface';
import { FFB_licensee } from '../../../../common/ffb/interface/licensee.interface';
import { FormControl, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule, UpperCasePipe } from '@angular/common';
import { PhonePipe } from '../../../../common/pipes/phone.pipe';
import { InputPlayerComponent } from '../../../../common/ffb/input-licensee/input-player.component';
import { FFBplayer } from '../../../../common/ffb/interface/FFBplayer.interface';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { GetNewbeeComponent } from '../modals/get-newbee/get-newbee.component';
import { ToastService } from '../../../../common/toaster/toast.service';

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [FormsModule, CommonModule, ReactiveFormsModule, UpperCasePipe, PhonePipe, InputPlayerComponent],
  templateUrl: './members.component.html',
  styleUrl: './members.component.scss'
})
export class MembersComponent implements OnInit {
  members: Member[] = [];
  filteredMembers: Member[] = [];
  // missingMembers: Member[] = [];
  thisSeasonMembersNbr: number = 0;
  licensees: FFB_licensee[] = [];
  new_player!: FFBplayer;
  season: string = '';

  filters: string[] = ['Tous', ' de cette saison', ' non encore à jour'];
  selection: string = '';

  verbose: string = '';

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
      this.selection_filter();
    });

    this.licenseesService.list_FFB_licensees$().subscribe((licensees) => {
      this.licensees = licensees;
      // console.log('MembersComponent.ngOnInit licensees', licensees);
    });
    combineLatest([this.sysConfService.get_configuration(), this.membersService.listMembers()]).subscribe(([conf, members]) => {
      this.season = conf.season;

      this.members = members.sort((a, b) => a.lastname.localeCompare(b.lastname));
      this.thisSeasonMembersNbr = this.members.reduce((acc, member) => {
        return (member.season === this.season || member.is_sympathisant) ? acc + 1 : acc;
      }, 0);

      this.filteredMembers = this.members;
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
          license_status: 'unknown',
          is_sympathisant: false,
        }
        this.membersService.createMember(new_member).then((_member) => {
          this.toastService.showSuccessToast('Nouveau membre non licencié', new_member.lastname + ' ' + new_member.firstname);
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
      license_taken_at: "BCSTO",
      license_status: "unknown",
      is_sympathisant: false,
    }
  }

  getMembersfromFFB() {
    this.verbose = '';
    this.licensees.forEach((licensee) => {
      this.createOrUpdateMember(licensee);
    });
    if (this.verbose.length === 0) {
      this.verbose = '.. la base adhérents est à jour (aucune modification) ';
    }
  }

  selection_filter() {
    this.selection = this.radioButtonGroup.value.radioButton;
    this.filteredMembers = this.members.filter((member: Member) => {
      switch (this.selection) {
        case this.filters[0]: //'Tous':
          return member;
        case this.filters[1]: //'à jour':
          return (member.season === this.season || member.is_sympathisant) ? member : false;
        case this.filters[2]: //'non à jour':
          return (member.season !== this.season && !member.is_sympathisant) ? member : false;
      }
      return member;
    });
  }



  async createOrUpdateMember(licensee: FFB_licensee) {
    let existingMember = this.members.find((m) => m.license_number === licensee.license_number);

    if (existingMember) {
      let member = this.compare(existingMember, licensee);
      if (member !== null) {
        // this.verbose += 'modification : ' + member.lastname + ' ' + member.firstname + '\n';
        console.log('%s updated to %s', existingMember.lastname, member.lastname);
        await this.membersService.updateMember(member);
      }

    } else {
      // console.log('MembersComponent.createOrUpdateMember create');
      let newMember = this.createNewMember(licensee);
      this.verbose += 'creation : ' + newMember.lastname + ' ' + newMember.firstname + '\n';
      let new_member = await this.membersService.createMember(newMember);
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
      season: licensee.season ?? '',
      email: licensee.email ?? '',
      phone_one: licensee.phone_one,
      license_taken_at: licensee.orga_license_name ?? 'BCSTO',
      license_status: licensee.license_id ? (licensee.free ? 'free' : 'paied') : 'unpaied',
      is_sympathisant: licensee.is_sympathisant ?? false,


    }
    let is: { [key: string]: any } = member;
    let next: { [key: string]: any } = nextMember;
    let diff: boolean = false;

    for (let key in next) {
      if (next[key] !== is[key]) {
        // console.log('diff on', key, is[key], next[key]);
        this.verbose += 'updating ' + member.lastname + ' ' + member.firstname + ' (' + key + ')' + '\n';
        diff = true;
      }
    }
    return diff ? nextMember : null;
  }

  createNewMember(licensee: FFB_licensee): Member {
    return {
      id: '',
      gender: licensee.gender,
      firstname: licensee.firstname,
      lastname: licensee.lastname,
      license_number: licensee.license_number,
      birthdate: licensee.birthdate,
      city: this.capitalize_first(licensee.city?.toLowerCase()),
      season: licensee.season ?? '',
      email: licensee.email ?? '',
      phone_one: licensee.phone_one,
      is_sympathisant: licensee.is_sympathisant ?? false,
      license_status: licensee.license_id ? (licensee.free ? 'free' : 'paied') : 'unpaied',
      license_taken_at: licensee.orga_license_name ?? 'BCSTO',
    }

  }
  deleteMember(member: Member) {
    this.membersService.deleteMember(member);
  }

  license_status_logo(status: string): string {
    switch (status) {
      case 'free':
        return '✔';
      case 'paied':
        return '☑';
      case 'unpaied':
        return '❌';
      default:
        return '?';
    }
  }
}

