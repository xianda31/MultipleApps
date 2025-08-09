import { CommonModule, UpperCasePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FFB_licensee } from '../../common/ffb/interface/licensee.interface';
import { FormControl, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { LicenseesService } from './services/licensees.service';
import { MembersService } from '../services/members.service';

@Component({
    selector: 'app-members',
    imports: [ReactiveFormsModule, FormsModule, CommonModule, UpperCasePipe],
    templateUrl: './licensees.component.html',
    styleUrl: './licensees.component.scss'
})
export class LicenseesComponent implements OnInit {
  licensees!: FFB_licensee[];
  filteredLicensees: FFB_licensee[] = [];
  sympatisantsNbr: number = 0;
  licenseesNbr: number = 0;
  filters: string[] = ['Tous', 'adhérents-licenciés', 'sympathisants'];
  selection: string = '';
  loaded: boolean = false;

  constructor(
    private licenseesService: LicenseesService,
    private membersService: MembersService
  ) { }

  radioButtonGroup: FormGroup = new FormGroup({
    radioButton: new FormControl(this.filters[0])
  });

  ngOnInit(): void {
    this.loaded = false;
    this.licenseesService.list_FFB_licensees$().subscribe((licensees) => {
      this.licensees = licensees;
      this.filteredLicensees = this.licensees;
      this.categoriesCount();
      this.loaded = true;
    });

    this.radioButtonGroup.valueChanges.subscribe(() => {
      this.filter();
    });
  }

  filter() {
    this.selection = this.radioButtonGroup.value.radioButton;
    this.filteredLicensees = this.licensees.filter((licensee: FFB_licensee) => {
      switch (this.selection) {
        case this.filters[0]:  //'Tous':
          return licensee;
        case this.filters[1]: //'licenciés':
          return licensee.orga_license_id ? false : licensee;

        case this.filters[2]: //'sympathisants':
          return licensee.orga_license_id ? licensee : false;
      }
      return licensee;
    });
  }

  categoriesCount() {
    this.licenseesNbr = this.licensees.length;
    this.sympatisantsNbr = this.licensees.reduce((acc, licensee) => {
      return licensee.orga_license_id ? acc + 1 : acc;
    }, 0);
    this.licenseesNbr = this.licenseesNbr - this.sympatisantsNbr;
  }

  is_a_registred_member(licensee: FFB_licensee): boolean {
    return !this.membersService.getMemberbyLicense(licensee.license_number);
  }
}
