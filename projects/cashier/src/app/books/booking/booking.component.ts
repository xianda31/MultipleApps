import { CommonModule, formatDate } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { BookService } from '../../book.service';
import { BANK_OP_TYPE, bank_op_types_for_op_class, EXPENSES_ACCOUNTS, f_Value, Financial, financial_of_bank_op_type, op_Value, OPERATION_CLASS, PRODUCTS_ACCOUNTS, season } from '../../../../../common/new_sales.interface';
import { Bank } from '../../../../../common/system-conf.interface';
import { map, Observable } from 'rxjs';
import { SystemDataService } from '../../../../../common/services/system-data.service';

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './booking.component.html',
  styleUrl: './booking.component.scss'
})
export class BookingComponent {
  banks !: Bank[];
  club_bank!: Bank;

  BANK_OP_TYPES = BANK_OP_TYPE;
  bank_op_types !: BANK_OP_TYPE[];
  OPERATION_CLASSES = OPERATION_CLASS;
  op_classes = Object.values(OPERATION_CLASS).filter((value) => value !== OPERATION_CLASS.REVENUE_FROM_MEMBER);

  form!: FormGroup;
  expenses_accounts = Object.values(EXPENSES_ACCOUNTS);
  revenues_accounts = Object.values(PRODUCTS_ACCOUNTS);
  show_expenses = true;

  // operation_type!: OPERATION_TYPE;

  constructor(
    private fb: FormBuilder,
    private bookService: BookService,
    private systemDataService: SystemDataService,

  ) {
  }

  ngOnInit() {

    this.systemDataService.configuration$.pipe(map((conf) => conf.banks)).subscribe((banks) => {
      this.banks = banks;
      this.club_bank = this.banks.find(bank => bank.key === 'AGR')!;
      this.init_form();
    }
    );

    this.form.controls['op_class'].valueChanges.subscribe((value) => {
      this.bank_op_types = bank_op_types_for_op_class(value);
    });

    this.form.controls['bank_op_type'].valueChanges.subscribe((value) => {
      // gestion des validators pour les champs bank_name et cheque_ref
      this.form.controls['bank_name'].clearValidators();
      this.form.controls['cheque_ref'].clearValidators();

      if (value === BANK_OP_TYPE.cheque_deposit) {
        this.form.controls['bank_name'].addValidators([Validators.required]);
        this.form.controls['cheque_ref'].addValidators([Validators.required]);
      } else if (value === BANK_OP_TYPE.cheque_emit) {
        this.form.controls['cheque_ref'].addValidators([Validators.required]);
        this.form.controls['bank_name'].patchValue(this.club_bank.name);
        this.form.controls['bank_name'].disable();
      }
      this.form.controls['bank_name'].updateValueAndValidity();
      this.form.controls['cheque_ref'].updateValueAndValidity();
      this.form.updateValueAndValidity();
    });

    this.form.controls['values'].valueChanges.subscribe((value) => {
      let sum = value
        .map((val: string) => this.parse_to_float(val))
        .reduce((acc: number, val: number) => acc + (val ?? 0), 0);
      this.form.controls['total'].setValue(sum);
    });
  }

  parse_to_float(value: string): number {
    return (!Number.isNaN(value) && value !== '') ? parseFloat(value) : 0;
  }

  get bank_op_type(): BANK_OP_TYPE {
    return this.form.get('bank_op_type')?.value;
  }
  get op_class(): OPERATION_CLASS {
    return this.form.get('op_class')?.value;
  }


  init_form() {
    const today = formatDate(new Date(), 'yyyy-MM-dd', 'en');
    this.form = this.fb.group({
      'date': [today, Validators.required],
      'op_class': ['', Validators.required],
      'bank_op_type': ['', Validators.required],
      'label': ['', Validators.required],
      'total': new FormControl<number>({ value: 0, disabled: true }),
      'values': this.fb.array(this.expenses_accounts.map(field => new FormControl<string>('', Validators.pattern(/^\d+(\.\d+)?$/)))),
      'bank_name': [''],
      'cheque_ref': [''],
    });

  }

  onSubmit() {
    console.log(this.form.value);
    let op_values: op_Value = {};
    if (this.op_class === OPERATION_CLASS.OTHER_REVENUE) {
      this.revenues_accounts.forEach((account: PRODUCTS_ACCOUNTS, index: number) => {
        let value = this.parse_to_float(this.form.controls['values'].value[index]);
        if (value !== 0) op_values[account] = value;
      });
    } else {
      this.expenses_accounts.forEach((account: EXPENSES_ACCOUNTS, index: number) => {
        let value = this.parse_to_float(this.form.controls['values'].value[index]);
        if (value !== 0) op_values[account] = value;
      });
    }

    let financial_account = financial_of_bank_op_type(this.form.controls['bank_op_type'].value);
    let amounts: f_Value = { [financial_account]: this.form.controls['total'].value };
    let booking: Financial = {
      season: season(new Date(this.form.controls['date'].value)),
      date: this.form.controls['date'].value,
      bank_op_type: this.form.controls['bank_op_type'].value,
      amounts: amounts,
      operations: [
        {
          label: this.form.controls['label'].value,
          class: this.form.controls['op_class'].value,
          values: op_values
        }
      ]
    };
    console.log(booking);
    this.init_form();
  }


}
