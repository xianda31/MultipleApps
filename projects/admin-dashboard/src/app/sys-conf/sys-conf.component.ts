import { Component } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { SystemConfiguration } from '../../../../common/system-conf.interface';
import { ToastService } from '../../../../common/toaster/toast.service';




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
  // financial_results_tree: Financial_results_tree = FINANCIAL_RESULTS_TREE;

  constructor(
    private systemDataService: SystemDataService,
    private toatService: ToastService,
    private fb: FormBuilder
  ) {

    this.systemFormGroup = this.fb.group({
      club_identifier: [''],
      dev_mode: [''],
      season: [''],
      club_bank_key: [''],
      member_trn_price: 3,
      non_member_trn_price: 4,

      financial_tree: this.fb.group({
        classes: this.fb.array([
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
      thumbnail: this.fb.group({
        width: [300],
        height: [200],
        ratio: [1.78]
      })
    });
  }

  ngOnInit(): void {
    this.systemDataService.get_configuration().subscribe((configuration) => {
      // configuration.financial_tree.classes = [
      //   { key: "LIC", description: "licence FFB" },
      //   { key: "CMP", description: "compétition" },
      //   { key: "FOR", description: "formation bridge" },
      //   { key: "FET", description: "festif" },
      //   { key: "FON", description: "fonctionnement" },
      //   { key: "DIV", description: "divers" },
      // ]
      this.loadDataInFormGroup(configuration);
      this.fileUrl = this.systemDataService.get_file_url(configuration);
      this.loaded = true;
    });
  }

  save_configuration() {
    const configuration = this.systemFormGroup.value;
    console.log('configuration', configuration);
    this.systemDataService.save_configuration(configuration);
  }

  get expenses() {
    return this.systemFormGroup.get('financial_tree')?.get('expenses') as FormArray;
  }

  get revenues() {
    return this.systemFormGroup.get('financial_tree')?.get('revenues') as FormArray;
  }

  get classes() {
    return this.systemFormGroup.get('financial_tree')?.get('classes') as FormArray;
  }

  get banks() {
    return this.systemFormGroup.get('banks') as FormArray;
  }
  get_club_bank(): string {
    let key = this.systemFormGroup.get('club_bank_key')?.value;
    let cntrl = this.banks.controls.find((bank) => bank.value.key === key);
    return cntrl?.value.name ?? '???';
  }

  loadDataInFormGroup(configuration: SystemConfiguration) {
    this.systemFormGroup.patchValue(configuration);
    // patchValue doest not work for FormArray ; work-around method : clear and re-populate
    this.classes.clear();
    this.expenses.clear();
    this.revenues.clear();

    configuration.financial_tree.classes.forEach((account: any) => {
      this.classes!.push(this.fb.group(account));
    });
    configuration.financial_tree.expenses.forEach((account: any) => {
      this.expenses.push(this.fb.group(account));
    }
    );
    configuration.financial_tree.revenues.forEach((account: any) => {
      this.revenues.push(this.fb.group(account));
    });

    // const keys = Object.keys(configuration.financial_tree);
    // keys.forEach((key) => {
    //   let revenue = configuration.financial_tree[key].revenue;
    //   let revenue_keys = Object.keys(revenue);
    //   revenue_keys.forEach((revenue_key) => {
    //     this.revenues.push(this.fb.group({ class: key, key: revenue_key, description: revenue[revenue_key] }));
    //   });

    //   let expense = configuration.financial_tree[key].expense;
    //   let expense_keys = Object.keys(expense);
    //   expense_keys.forEach((expense_key) => {
    //     this.expenses.push(this.fb.group({ class: key, key: expense_key, description: expense[expense_key] }));
    //   }
    //   );
    // });
    // configuration.charge_accounts.forEach((account: any) => {
    //   this.expenses.push(this.fb.group(account));
    // });

    // this.revenues.clear();
    // configuration.product_accounts.forEach((account: any) => {
    //   this.revenues.push(this.fb.group(account));
    // });

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

}
