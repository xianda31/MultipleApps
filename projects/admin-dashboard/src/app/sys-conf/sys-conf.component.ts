import { Component } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule, JsonPipe } from '@angular/common';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { SystemConfiguration } from '../../../../common/system-conf.interface';




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
  }
}
