import { Component, OnInit } from '@angular/core';
import { MembersService } from './service/members.service';
import { LicenseesService } from '../licensees/services/licensees.service';
import { combineLatest, Observable } from 'rxjs';
import { Member } from '../../../../common/members/member.interface';
import { FFB_licensee } from '../../../../common/ffb/interface/licensee.interface';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule, UpperCasePipe } from '@angular/common';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, UpperCasePipe],
  templateUrl: './members.component.html',
  styleUrl: './members.component.scss'
})
export class MembersComponent implements OnInit {
  members !: Member[];
  filteredMembers: Member[] = [];
  // missingMembers: Member[] = [];
  thisSeasonMembersNbr: number = 0;
  licensees !: FFB_licensee[];

  filters: string[] = ['Tous', ' de cette saison', ' non encore à jour'];
  selection: string = '';

  verbose: string = '';

  radioButtonGroup: FormGroup = new FormGroup({
    radioButton: new FormControl('Tous')
  });

  constructor(
    private licenseesService: LicenseesService,
    private membersService: MembersService,
  ) {

  }

  ngOnInit(): void {



    this.radioButtonGroup.valueChanges.subscribe(() => {
      this.filter();
    });

    this.licenseesService.FFB_licensees$.subscribe((licensees) => {
      this.licensees = licensees;
    });

    this.membersService.listMembers().subscribe((members) => {
      this.members = members.sort((a, b) => a.lastname.localeCompare(b.lastname));
      this.filteredMembers = this.members;
      this.thisSeasonMembersNbr = this.members.reduce((acc, member) => {
        return (member.season === '2024/2025' || member.is_sympathisant) ? acc + 1 : acc;
      }, 0);
    });

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

  filter() {
    this.selection = this.radioButtonGroup.value.radioButton;
    this.filteredMembers = this.members.filter((member: Member) => {
      switch (this.selection) {
        case this.filters[0]: //'Tous':
          return member;
        case this.filters[1]: //'à jour':
          return (member.season === '2024/2025' || member.is_sympathisant) ? member : false;
        case this.filters[2]: //'non à jour':
          return (member.season !== '2024/2025' && !member.is_sympathisant) ? member : false;
      }
      return member;
    });
  }



  createOrUpdateMember(licensee: FFB_licensee) {
    let existingMember = this.members.find((m) => m.license_number === licensee.license_number);

    if (existingMember) {
      let member = this.compare(existingMember, licensee);
      if (member !== null) {
        this.verbose += 'modification : ' + member.lastname + ' ' + member.firstname + '\n';

        this.membersService.updateMember(member!);
      }

    } else {
      // console.log('MembersComponent.createOrUpdateMember create');
      let newMember = this.createNewMember(licensee);
      this.verbose += 'creation : ' + newMember.lastname + ' ' + newMember.firstname + '\n';
      this.membersService.createMember(newMember);
    }
  }


  compare(member: Member, licensee: FFB_licensee): Member | null {


    let nextMember: Member = {
      id: member.id,
      license_number: licensee.license_number,
      gender: licensee.gender,
      firstname: licensee.firstname,
      lastname: licensee.lastname,
      birthdate: licensee.birthdate,
      city: licensee.city ?? '',
      season: licensee.season ?? '',
      email: licensee.email ?? '',
      phone_one: licensee.phone_one,
      orga_license_name: licensee.orga_license_name ?? 'BCSTO',
      is_sympathisant: licensee.is_sympathisant ?? false,
      has_account: member.has_account,

    }
    let is: { [key: string]: any } = member;
    let next: { [key: string]: any } = nextMember;
    let diff: boolean = false;

    for (let key in next) {
      if (next[key] !== is[key]) {
        console.log('MembersComponent.compare  : diff on', key, is[key], next[key]);
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
      city: licensee.city ?? '',
      season: licensee.season ?? '',
      email: licensee.email ?? '',
      phone_one: licensee.phone_one,
      orga_license_name: licensee.orga_license_name ?? 'BCSTO',
      is_sympathisant: licensee.is_sympathisant ?? false,
      has_account: false,
    }

  }
  deleteMember(member: Member) {
    this.membersService.deleteMember(member.id);
  }
}

