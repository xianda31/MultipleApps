import { Component } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule, JsonPipe } from '@angular/common';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { SystemConfiguration } from '../../../../common/system-conf.interface';
import { map } from 'rxjs';




@Component({
  selector: 'app-sys-conf',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './sys-conf.component.html',
  styleUrl: './sys-conf.component.scss'
})
export class SysConfComponent {

  systemFormGroup!: FormGroup;
  loaded!: boolean;
  fileUrl: any;


  constructor(
    private systemDataService: SystemDataService,
    private fb: FormBuilder
  ) {

    this.systemFormGroup = this.fb.group({
      club_identifier: [''],
      dev_mode: [''],
      season: [''],
      member_trn_price: 3,
      non_member_trn_price: 4,

      charge_accounts: this.fb.array([
        this.fb.group({
          key: [''],
          description: ['']
        })
      ]),
      product_accounts: this.fb.array([
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
    this.systemDataService.configuration$.subscribe((configuration) => {
      this.loadDataInFormGroup(configuration);
      this.fileUrl = this.systemDataService.get_file_url(configuration);
      this.loaded = true;
    });
  }

  save_configuration() {
    const configuration = this.systemFormGroup.value;
    this.systemDataService.save_configuration(configuration);
  }

  get charge_accounts() {
    return this.systemFormGroup.get('charge_accounts') as FormArray;
  }

  get product_accounts() {
    return this.systemFormGroup.get('product_accounts') as FormArray;
  }

  get banks() {
    return this.systemFormGroup.get('banks') as FormArray;
  }

  loadDataInFormGroup(configuration: SystemConfiguration) {
    this.systemFormGroup.patchValue(configuration);
    // patchValue doest not work for FormArray ; work-around : clear and re-populate
    this.charge_accounts.clear();
    configuration.charge_accounts.forEach((account: any) => {
      this.charge_accounts.push(this.fb.group(account));
    });

    this.product_accounts.clear();
    configuration.product_accounts.forEach((account: any) => {
      this.product_accounts.push(this.fb.group(account));
    });

    this.banks.clear();
    configuration.banks.forEach((bank: any) => {
      this.banks.push(this.fb.group(bank));
    });

  }


  async onInput(event: any) {
    const file = event.target.files[0];
    // console.log('file', file);
    if (file) {
      const text = await file.text();
      console.log('text', text);
      this.loadDataInFormGroup(JSON.parse(text));
    }

  }

}
