import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SystemConfiguration } from './system-conf.interface';
import { Observable } from 'rxjs';
import { FileService } from '../../../../common/services/files.service';
import { S3Item } from '../../../../common/file.interface';
import { SystemDataService } from './system-data.service';



interface System_conf {
  "club_identifier": string;
  "mode": string;
  "season": string;
  "debit_accounts": Account[];
  "credit_accounts": Account[];
}
interface Account {
  key: string;
  description: string;
}
@Component({
  selector: 'app-test',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './test.component.html',
  styleUrl: './test.component.scss'
})
export class TestComponent {

  systemFormGroup!: FormGroup;
  loaded!: boolean;
  S3Items: S3Item[] = [];
  folders: Set<string> = new Set();



  constructor(
    private fileService: FileService,
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
    });

  }

  get debit_accounts() {
    return this.systemFormGroup.get('debit_accounts') as FormArray;
  }

  get credit_accounts() {
    return this.systemFormGroup.get('credit_accounts') as FormArray;
  }

  ngOnInit(): void {
    // this.save_configuration(this.system_configuration);
    this.read_configuration();
  }


  read_configuration() {
    this.systemDataService.read_configuration().then((configuration) => {
      this.loadDataInFormGroup(configuration);
      this.loaded = true;
    });
  }

  save_configuration() {
    const configuration = this.systemFormGroup.value;
    this.systemDataService.save_configuration(configuration);
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
