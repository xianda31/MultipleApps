import { CommonModule, JsonPipe, UpperCasePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FfbService } from '../../../../common/ffb/services/ffb.service';
import { FFB_tournament } from '../../../../common/ffb/interface/FFBtournament.interface';
import { FFB_licensee } from '../../../../common/ffb/interface/licensee.interface';
import { FormControl, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { LicenseesService } from './services/licensees.service';
import { MembersService } from '../members/service/members.service';

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, CommonModule, UpperCasePipe],
  templateUrl: './licensees.component.html',
  styleUrl: './licensees.component.scss'
})
export class LicenseesComponent implements OnInit {

  constructor(
    // private FFBService: FfbService,
    private licenseesService: LicenseesService,
    private membersService: MembersService
  ) { }
  members!: FFB_licensee[];
  filteredMembers: FFB_licensee[] = [];
  sympatisantsNbr: number = 0;
  licenseesNbr: number = 0;
  membersNbr: number = 0;
  filters: string[] = ['Tous', 'adhérents-licenciés', 'sympathisants'];
  selection: string = '';

  radioButtonGroup: FormGroup = new FormGroup({
    radioButton: new FormControl(this.filters[0])
  });

  async ngOnInit(): Promise<void> {
    this.licenseesService.FFB_licensees$.subscribe((licensees) => {
      this.members = licensees;
      this.filteredMembers = this.members;
      this.categoriesCount();
    });


    this.radioButtonGroup.valueChanges.subscribe(() => {
      this.filter();
    });
  }

  filter() {
    this.selection = this.radioButtonGroup.value.radioButton;
    this.filteredMembers = this.members.filter((member: FFB_licensee) => {
      switch (this.selection) {
        case this.filters[0]:  //'Tous':
          return member;
        case this.filters[1]: //'licenciés':
          return member.orga_license_id ? false : member;

        case this.filters[2]: //'sympathisants':
          return member.orga_license_id ? member : false;
      }
      return member;
    });
  }

  categoriesCount() {
    this.membersNbr = this.members.length;
    this.sympatisantsNbr = this.members.reduce((acc, member) => {
      return member.orga_license_id ? acc + 1 : acc;
    }, 0);
    this.licenseesNbr = this.membersNbr - this.sympatisantsNbr;
  }

  is_a_registred_member(member: FFB_licensee): boolean {
    return this.membersService.isMember(member.license_number);
  }
}
