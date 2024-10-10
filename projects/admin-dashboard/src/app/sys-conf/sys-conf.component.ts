import { Component } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule, JsonPipe } from '@angular/common';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { SystemConfiguration } from '../../../../common/system-conf.interface';
import { map } from 'rxjs';




@Component({
  selector: 'app-sys-conf',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, JsonPipe],
  templateUrl: './sys-conf.component.html',
  styleUrl: './sys-conf.component.scss'
})
export class SysConfComponent {

  systemFormGroup!: FormGroup;
  loaded!: boolean;

  constructor(
    private systemDataService: SystemDataService,
    private fb: FormBuilder
  ) {

    this.systemFormGroup = this.fb.group({
      club_identifier: [''],
      mode: [''],
      season: [''],
      debit_accounts: this.fb.array([
        this.fb.group({
          key: [''],
          description: ['']
        })
      ]),
      credit_accounts: this.fb.array([
        this.fb.group({
          key: [''],
          description: ['']
        })
      ]),
      banks: this.fb.array([
        this.fb.group({
          key: [''],
          name: ['']
        })
      ]),
      thumbnail: this.fb.group({
        width: [300],
        height: [200],
        ratio: [1.78]
      })
    });
  }

  ngOnInit(): void {
    this.systemDataService.read_configuration().subscribe((configuration) => {
      this.loadDataInFormGroup(configuration);
      this.loaded = true;
    });
  }

  save_configuration() {
    const configuration = this.systemFormGroup.value;
    this.systemDataService.save_configuration(configuration);
  }

  get debit_accounts() {
    return this.systemFormGroup.get('debit_accounts') as FormArray;
  }

  get credit_accounts() {
    return this.systemFormGroup.get('credit_accounts') as FormArray;
  }

  get banks() {
    return this.systemFormGroup.get('banks') as FormArray;
  }

  loadDataInFormGroup(configuration: SystemConfiguration) {
    this.systemFormGroup.patchValue(configuration);
    // patchValue doest not work for FormArray ; work-around : clear and re-populate
    this.debit_accounts.clear();
    configuration.debit_accounts.forEach((account: any) => {
      this.debit_accounts.push(this.fb.group(account));
    });

    this.credit_accounts.clear();
    configuration.credit_accounts.forEach((account: any) => {
      this.credit_accounts.push(this.fb.group(account));
    });

    this.banks.clear();
    configuration.banks.forEach((bank: any) => {
      this.banks.push(this.fb.group(bank));
    });

    // const Bank_names: { [key: string]: string } = {
    //   'COU': 'Banque Courtois',
    //   'POP': 'Banque Populaire',
    //   'POS': 'Banque Postale',
    //   'BNP': 'BNP',
    //   'RAM': 'Boursorama',
    //   'EPA': 'Caisse d\'Epargne',
    //   'AGR': 'Crédit Agricole',
    //   'LYO': 'Crédit Lyonnais',
    //   'MUT': 'Crédit Mutuel',
    //   'FOR': 'Fortuneo',
    //   'Hi!': 'HSBC',
    //   'ING': 'ING',
    //   "AXA": 'AXA',
    //   'LCL': 'LCL',
    //   'SOG': 'Société Générale',
    //   'CCF': 'CCF',
    //   'COO': 'Crédit Coopératif',
    // };

    // Object.keys(Bank_names).forEach((key) => {
    //   this.banks.push(this.fb.group({ key, name: Bank_names[key] }));
    // });
  }
}
