import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { MembersService } from './service/members.service';
import { LicenseesService } from '../licensees/services/licensees.service';
import { combineLatest, map, switchMap } from 'rxjs';
import { Member } from '../../../../common/member.interface';
import { FFB_licensee } from '../../../../common/ffb/interface/licensee.interface';
import { FormControl, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule, UpperCasePipe } from '@angular/common';
import { PhonePipe } from '../../../../common/pipes/phone.pipe';
import { InputPlayerComponent } from '../../../../common/ffb/input-licensee/input-player.component';
import { FFBplayer } from '../../../../common/ffb/interface/FFBplayer.interface';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { NgbModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { GetNewbeeComponent } from '../modals/get-newbee/get-newbee.component';
import { ToastService } from '../../../../common/toaster/toast.service';

@Component({
  selector: 'app-members',
  encapsulation: ViewEncapsulation.None, // nécessaire pour que les CSS des tooltips fonctionnent
  imports: [FormsModule, CommonModule, ReactiveFormsModule, UpperCasePipe, PhonePipe, InputPlayerComponent, NgbTooltipModule],
  templateUrl: './members.component.html',
  styleUrl: './members.component.scss'
})
export class MembersComponent implements OnInit {
  members: Member[] = [];
  filteredMembers: Member[] = [];
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


    this.sysConfService.get_configuration().pipe(
      switchMap((conf) => {
        this.season = conf.season;
        return combineLatest([
          this.membersService.listMembers(),
          this.licenseesService.list_FFB_licensees$()
        ]);
      })
    ).subscribe(([members, licensees]) => {
      this.members = members;
      this.licensees = licensees;
      this.check_licenses(this.season);

      this.updateDBfromFFB();
      this.filteredMembers = this.members;
    }
    );
  }


  async check_licenses(season: string) {
    for (const member of this.members) {
      if (member.season !== season && member.license_status !== 'unpaied') {
        member.license_status = 'unpaied';
        await this.membersService.updateMember(member);
        this.toastService.showWarning('Licences', `Licence de ${member.lastname} ${member.firstname} obsolète `);
      }
    }
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
      license_status: player.is_current_season ? 'paied' : 'unknown',
      is_sympathisant: false,
    }
  }

  updateDBfromFFB() {
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
          return (member.season === this.season) ? member : false;
        case this.filters[2]: //'non à jour':
          return (member.season !== this.season) ? member : false;
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
      season: licensee.season ?? (licensee.register ? this.season : ''),
      email: licensee.email?.trim().toLowerCase() ?? '',
      phone_one: licensee.phone_one,
      license_taken_at: licensee.orga_license_name ?? 'BCSTO',
      license_status: licensee.license_id ? (licensee.free ? 'offerte' : 'paied') : 'unpaied',
      is_sympathisant: licensee.is_sympathisant ?? false,


    }
    let is: { [key: string]: any } = member;
    let next: { [key: string]: any } = nextMember;
    let diff: boolean = false;

    for (let key in next) {
      if (next[key] !== is[key]) {
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
      lastname: licensee.lastname.toUpperCase(),
      license_number: licensee.license_number,
      birthdate: licensee.birthdate,
      city: this.capitalize_first(licensee.city?.toLowerCase()),
      season: licensee.season ?? (licensee.register ? this.season : ''),
      email: licensee.email ?? '',
      phone_one: licensee.phone_one,
      is_sympathisant: licensee.is_sympathisant ?? false,
      license_status: licensee.license_id ? (licensee.free ? 'offerte' : 'réglée') : 'à payer',
      license_taken_at: licensee.orga_license_name ?? 'BCSTO',
    }

  }
  deleteMember(member: Member) {
    this.membersService.deleteMember(member);
  }

}

