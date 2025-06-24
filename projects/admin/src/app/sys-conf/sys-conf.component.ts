import { Component } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { SystemConfiguration } from '../../../../common/system-conf.interface';
import { ToastService } from '../../../../common/toaster/toast.service';
import { FileService } from '../../../../common/services/files.service';




@Component({
    selector: 'app-sys-conf',
    imports: [CommonModule, FormsModule, ReactiveFormsModule],
    templateUrl: './sys-conf.component.html',
    styleUrl: './sys-conf.component.scss'
})
export class SysConfComponent {

  systemFormGroup!: FormGroup;
  loaded!: boolean;
  export_file_url: any;

  constructor(
    private systemDataService: SystemDataService,
    private toatService: ToastService,
    private fileService: FileService,
    private fb: FormBuilder
  ) {

    this.systemFormGroup = this.fb.group({
      club_identifier: [''],
      trace_mode: [false],
      season: [''],
      club_bank_key: [''],
      member_trn_price: 3,
      non_member_trn_price: 4,

      revenue_and_expense_tree: this.fb.group({
        sections: this.fb.array([
          this.fb.group({
            key: [''],
            description: ['']
          })
        ]),
        revenues: this.fb.array([
          this.fb.group({
            class: [''],
            key: [''],
            description: ['']
          })
        ]),
        expenses: this.fb.array([
          this.fb.group({
            class: [''],
            key: [''],
            description: ['']
          })
        ]),
      }),
      banks: this.fb.array([
        this.fb.group({
          key: [''],
          name: ['']
        })
      ]),

      profit_and_loss: this.fb.group({
      debit_key: [''],
      credit_key: [''],
      }),

      thumbnail: this.fb.group({
        width: [300],
        height: [200],
        ratio: [1.78]
      })
    });
  }

  ngOnInit(): void {
    this.systemDataService.get_configuration()
    .subscribe({
      next : (configuration) => {
      this.loadDataInFormGroup(configuration);
      this.export_file_url = this.fileService.json_to_blob(configuration);
      this.loaded = true;
    },
      error: (error) => {
        console.error('error', error);
        this.toatService.showErrorToast('erreur de chargement de la configuration', 'vérifiez la connexion internet');
      }
  });
  }

  save_configuration() {
    const configuration = this.systemFormGroup.value;
    console.log('configuration', configuration);
    this.systemDataService.save_configuration(configuration);
  }

  get_trace_mode() {
    return this.systemFormGroup.get('trace_mode')?.value;
  }

  get season() {
    return this.systemFormGroup.get('season')?.value;
  }
  get expenses() {
    return this.systemFormGroup.get('revenue_and_expense_tree')?.get('expenses') as FormArray;
  }

  get revenues() {
    return this.systemFormGroup.get('revenue_and_expense_tree')?.get('revenues') as FormArray;
  }

  get sections() {
    return this.systemFormGroup.get('revenue_and_expense_tree')?.get('sections') as FormArray;
  }

  get banks() {
    return this.systemFormGroup.get('banks') as FormArray;
  }
  get club_bank(): string {
    let key = this.systemFormGroup.get('club_bank_key')?.value;
    let cntrl = this.banks.controls.find((bank) => bank.value.key === key);
    return cntrl?.value.name ?? '???';
  }

  get loss_account_key(): string {
    let key = this.systemFormGroup.get('profit_and_loss')?.get('loss_account_key')?.value;
    let cntrl = this.expenses.controls.find((account) => account.value.key === key);
    return cntrl?.value.description ?? '???';
  }
  get profit_account_key(): string {
    let key = this.systemFormGroup.get('profit_and_loss')?.get('profit_account_key')?.value;
    let cntrl = this.revenues.controls.find((account) => account.value.key === key);
    return cntrl?.value.description ?? '???';
  }

  loadDataInFormGroup(configuration: SystemConfiguration) {
    this.systemFormGroup.patchValue(configuration);
    // patchValue doest not work for FormArray ; work-around method : clear and re-populate
    this.sections.clear();
    this.expenses.clear();
    this.revenues.clear();

    configuration.revenue_and_expense_tree.sections.forEach((account: any) => {
      this.sections!.push(this.fb.group(account));
    });
    configuration.revenue_and_expense_tree.expenses.forEach((account: any) => {
      this.expenses.push(this.fb.group(account));
    }
    );
    configuration.revenue_and_expense_tree.revenues.forEach((account: any) => {
      this.revenues.push(this.fb.group(account));
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
      try {
        let json = JSON.parse(text);
        this.loadDataInFormGroup(json);
        this.toatService.showSuccessToast('fichier de configuration chargé', 'les données sont prêtes à être enregistrées');
      } catch (error) {
        console.error('error', error);
        this.toatService.showErrorToast('erreur chargement fichier de configuration', 'vérifiez la syntaxe');
      }
      // let json = JSON.parse(text);
      // this.loadDataInFormGroup(JSON.parse(text));
    }
  }

  prev_season() {
    let current_season = this.systemFormGroup.get('season')?.value;
    let prev_season = this.systemDataService.previous_season(current_season);
    this.systemFormGroup.get('season')?.setValue(prev_season);
    this.systemFormGroup.markAsTouched();
  }
  next_season() {
    let current_season = this.systemFormGroup.get('season')?.value;
    let next_season = this.systemDataService.next_season(current_season);
    this.systemFormGroup.get('season')?.setValue(next_season);
    this.systemFormGroup.markAsTouched();

  }

}
