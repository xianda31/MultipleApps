import { Component } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SystemDataService } from '../../common/services/system-data.service';
import { SystemConfiguration } from '../../common/interfaces/system-conf.interface';
import { ToastService } from '../../common/services/toast.service';




@Component({
  selector: 'app-sys-conf',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './sys-conf.component.html',
  styleUrl: './sys-conf.component.scss'
})
export class SysConfComponent {
  readonly seasonMonths = [
    { value: 7, label: 'juillet' },
    { value: 8, label: 'août' },
    { value: 9, label: 'septembre' },
    { value: 10, label: 'octobre' },
    { value: 11, label: 'novembre' },
    { value: 12, label: 'décembre' },
    { value: 1, label: 'janvier' },
    { value: 2, label: 'février' },
    { value: 3, label: 'mars' },
    { value: 4, label: 'avril' },
    { value: 5, label: 'mai' },
    { value: 6, label: 'juin' },
  ];

  systemFormGroup!: FormGroup;
  loaded!: boolean;
  newBankKey = '';
  newBankName = '';
  traceModeEnabled = false;
  bankOptionsList: { key: string; name: string }[] = [];

  constructor(
    private systemDataService: SystemDataService,
    private toastService: ToastService,
    private fb: FormBuilder
  ) {

    this.systemFormGroup = this.fb.group({
      club_identifier: [''],
      trace_mode: [false],
      include_system_visits: [false],
      club_bank_key: [''],
      assistance_request_retention_days: [90],
      remembered_auth_session_days: [30, [Validators.required, Validators.min(1), Validators.max(30)]],
      online_payment_active: [false],
      tpe_payment_active: [false],
      CB_fees_account: [''],
      minimum_cb_amount: [0],
      membership_payment_warning_month: [11, [Validators.required, Validators.min(1), Validators.max(12)]],

      fee_rates: this.fb.array([
        this.fb.group({
          key: ['standard'],
          member_price: [0],
          non_member_price: [0],
        })
      ]),


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
      
    });
  }

  ngOnInit(): void {
    this.systemDataService.get_configuration()
      .subscribe({
        next: (configuration) => {
          this.loadDataInFormGroup(configuration);
          this.loaded = true;
        },
        error: (error) => {
          console.error('error', error);
          this.toastService.showError('erreur de chargement de la configuration', 'vérifiez la connexion internet');
        }
      });

    this.systemFormGroup.get('trace_mode')?.valueChanges.subscribe((value) => {
      this.traceModeEnabled = !!value;
    });
  }

  save_configuration() {
    if (this.systemFormGroup.invalid) {
      this.systemFormGroup.markAllAsTouched();
      this.toastService.showWarning('Configuration', 'Corrigez les paramètres invalides avant de sauvegarder');
      return;
    }
    const new_configuration: SystemConfiguration = this.systemFormGroup.value;
    console.log('nouvelle configuration', new_configuration);
    this.systemDataService.save_configuration(new_configuration);
    this.toastService.showSuccess('configuration sauvegardée', 'les nouvelles données ont été enregistrées');
  }

  get expenses() {
    return this.systemFormGroup.get('revenue_and_expense_tree')?.get('expenses') as FormArray;
  }

  get revenues() {
    return this.systemFormGroup.get('revenue_and_expense_tree')?.get('revenues') as FormArray;
  }

  get fee_rates() {
    return this.systemFormGroup.get('fee_rates') as FormArray;
  }

  get sections() {
    return this.systemFormGroup.get('revenue_and_expense_tree')?.get('sections') as FormArray;
  }

  get banks() {
    return this.systemFormGroup.get('banks') as FormArray;
  }

  get includeSystemVisits(): boolean {
    return !!this.systemFormGroup.get('include_system_visits')?.value;
  }

  private computeBankOptions(): { key: string; name: string }[] {
    const seen = new Set<string>();
    return this.banks.controls
      .map(ctrl => ({
        key: String(ctrl.get('key')?.value ?? '').trim(),
        name: String(ctrl.get('name')?.value ?? '').trim(),
      }))
      .filter(bank => {
        if (!bank.key || seen.has(bank.key)) return false;
        seen.add(bank.key);
        return true;
      });
  }

  private refreshBankOptions(): void {
    this.bankOptionsList = this.computeBankOptions();
  }

  // Ajoute un nouveau code banque '???'/'autre'
  addBankCode(): void {
    const banks = this.banks;
    if (!banks) return;
    // Vérifie si le dernier élément est bien '???'
    const last = banks.at(banks.length - 1);
    if (!last || last.get('key')?.value !== '???') {
      banks.push(this.fb.group({ key: ['???'], name: ['autre'] }));
      this.refreshBankOptions();
    }
  }

  addBankFromDraft(): void {
    const key = this.newBankKey.trim();
    const name = this.newBankName.trim();

    if (!key) {
      this.toastService.showInfo('banques', 'Le code banque est requis');
      return;
    }

    const exists = this.banks.controls.some(ctrl => String(ctrl.get('key')?.value ?? '').trim() === key);
    if (exists) {
      this.toastService.showInfo('banques', `Le code banque "${key}" existe déjà`);
      return;
    }

    this.banks.push(this.fb.group({ key: [key], name: [name] }));
    this.refreshBankOptions();
    this.newBankKey = '';
    this.newBankName = '';
  }

  // Quand la key du dernier code banque est modifiée, recrée '???'/'autre' si besoin
  onBankKeyChange(i: number): void {
    const banks = this.banks;
    if (!banks) return;
    // Si on modifie le dernier et qu'il n'est plus '???', on ajoute un nouveau '???'
    if (i === banks.length - 1 && banks.at(i).get('key')?.value !== '???') {
      this.addBankCode();
    }
    this.refreshBankOptions();
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
    this.systemFormGroup.patchValue({
      ...configuration,
      membership_payment_warning_month: configuration.membership_payment_warning_month ?? 11,
    }, { emitEvent: false });
    // patchValue doest not work for FormArray ; work-around method : clear and re-populate
    this.sections.clear();
    this.expenses.clear();
    this.revenues.clear();
    this.banks.clear();
    this.fee_rates.clear();

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

    configuration.fee_rates
      .filter((fee_rate) => String(fee_rate.key) !== 'accession')
      .forEach((fee_rate: any) => {
        this.fee_rates.push(this.fb.group(fee_rate));
      });


    configuration.banks.forEach((bank: any) => {
      this.banks.push(this.fb.group(bank));
    });

    this.refreshBankOptions();
    this.traceModeEnabled = !!this.systemFormGroup.get('trace_mode')?.value;

  }

}
