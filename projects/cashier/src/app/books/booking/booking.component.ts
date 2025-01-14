import { CommonModule, formatDate } from '@angular/common';
import { Component, Input, SimpleChanges } from '@angular/core';
import { Location } from '@angular/common';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { BookService } from '../../book.service';
import { bank_values, Financial, operation_values, RECORD_CLASS, season, BANK_OPERATION_TYPE, Operation } from '../../../../../common/new_sales.interface';
import { Bank } from '../../../../../common/system-conf.interface';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { ToastService } from '../../../../../common/toaster/toast.service';
import { ACCOUNTING_OPERATION, get_accounting_operations, get_types_of_class } from '../../../../../common/booking.definition';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { Member } from '../../../../../common/member.interface';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './booking.component.html',
  styleUrl: './booking.component.scss'
})
export class BookingComponent {
  financial_id!: string;
  banks !: Bank[];
  club_bank!: Bank;
  members!: Member[];
  expenses_accounts !: string[]; //= Object.values(EXPENSES_ACCOUNTS);
  revenues_accounts !: string[]; //= Object.values(PRODUCTS_ACCOUNTS);

  BANK_OPERATION_TYPES = BANK_OPERATION_TYPE;
  op_types !: BANK_OPERATION_TYPE[];
  RECORD_CLASSES = RECORD_CLASS;
  op_classes = Object.values(RECORD_CLASS); //.filter((value) => value !== RECORD_CLASS.REVENUE_FROM_MEMBER);
  form!: FormGroup;
  form_ready = false;

  creation = false;
  selected_financial!: Financial;
  accounting_operation?: ACCOUNTING_OPERATION;

  constructor(
    private fb: FormBuilder,
    private bookService: BookService,
    private systemDataService: SystemDataService,
    private membersService: MembersService,
    private toastService: ToastService,
    private route: ActivatedRoute,
    private location: Location

  ) { }

  ngOnInit() {
    this.membersService.listMembers().subscribe((members) => {
      this.members = members;
    });

    this.systemDataService.configuration$.subscribe((conf) => {
      this.banks = conf.banks;
      this.club_bank = this.banks.find(bank => bank.key === 'AGR')!;
      this.expenses_accounts = conf.charge_accounts.map((account) => account.key);
      this.revenues_accounts = conf.product_accounts.map((account) => account.key);

      this.route.params.subscribe(params => {
        this.financial_id = params['id']; // Access the 'id' parameter from the URL
        if (this.financial_id !== undefined) {
          this.bookService.read_financial(this.financial_id)
            .then((financial) => {
              this.init_form();
              this.set_form(financial);
              this.valueChanges_subscribe();
              this.creation = false;
              this.form_ready = true;
            })
            .catch((error) => { throw new Error('error reading financial', error) });
        } else {
          // component in creation mode
          this.init_form();
          this.valueChanges_subscribe();
          this.creation = true;
          this.form_ready = true;
        }
      });

      this.route.parent?.params.subscribe(params => {
        console.log('parent params', params);
      });
    });
  }

  init_form() {
    const today = formatDate(new Date(), 'yyyy-MM-dd', 'en');
    this.accounting_operation = undefined!;
    this.form = this.fb.group({
      'id': [''],
      'date': [today, Validators.required],
      'op_class': ['', Validators.required],
      'op_type': ['', Validators.required],
      'total': new FormControl<number>({ value: 0, disabled: true }),
      'bank_name': [''],
      'cheque_number': [''],
      'operations': new FormArray([]),
    });

  }

  valueChanges_subscribe() {
    // form.op_class
    this.form.controls['op_class'].valueChanges.subscribe((op_class) => {
      this.accounting_operation = undefined!;
      this.op_types = get_types_of_class(op_class);

      this.operations.clear();
      this.form.controls['op_type'].setValue('', { emitEvent: false });

      switch (this.op_class) {
        case RECORD_CLASS.EXPENSE:
          this.add_operation(this.expenses_accounts, op_class);
          console.log('operation n° %s added', this.operations.length);
          break;
        case RECORD_CLASS.REVENUE_FROM_MEMBER:
        case RECORD_CLASS.OTHER_REVENUE:
          this.add_operation(this.revenues_accounts, op_class);
          console.log('operation n° %s added', this.operations.length);
          break;
        case RECORD_CLASS.MOVEMENT:
          this.form.controls['total'].enable();
          console.log('total enabled');
          break;
      }
    });


    // form.op_type

    this.form.controls['op_type'].valueChanges.subscribe((op_type) => {
      this.accounting_operation = get_accounting_operations(this.op_class, op_type);
      // gestion des validators pour les champs bank_name et cheque_ref
      switch (op_type) {
        case BANK_OPERATION_TYPE.cheque_deposit:
          this.form.controls['bank_name'].setValidators([Validators.required]);
          this.form.controls['cheque_number'].setValidators([Validators.required]);
          break;
        case BANK_OPERATION_TYPE.cheque_emit:
          this.form.controls['bank_name'].setValidators([Validators.required]);
          this.form.controls['cheque_number'].setValidators([Validators.required]);
          this.form.controls['bank_name'].patchValue(this.club_bank.key);
          this.form.controls['bank_name'].disable();
          break;
        default:
          this.form.controls['bank_name'].clearValidators();
          this.form.controls['cheque_number'].clearValidators();
          console.log('bank_name and cheque_number validators cleared');
          break;
      }
    });


  }

  add_operation(accounts: string[], label: string, values?: { [key: string]: number }, member?: string) {
    let operationForm = this.fb.group({
      'member': [member ?? '', member ? { validators: Validators.required } : {}],
      'label': [label],
      'values': this.fb.array(
        (accounts.map(field => new FormControl<string>((values?.[field]?.toString() ?? ''), [Validators.pattern(/^\d+(\.\d+)?$/)]))),
        { validators: [this.atLeastOneFieldValidator] }),
    });
    this.operations.push(operationForm);
    this.set_operationForm_change_detection(operationForm);
  }

  set_operationForm_change_detection(operationForm: FormGroup) {
    // TODO : what if several fields updated !!!
    operationForm.controls['values'].valueChanges.subscribe((value) => {
      let total = value
        .map((val: string) => this.parse_to_float(val))
        .reduce((acc: number, val: number) => acc + (val ?? 0), 0);
      this.form.controls['total'].setValue(total);
    });
  }

  set_form(financial: Financial) {

    console.log('financial to set', financial);
    this.selected_financial = financial;

    this.accounting_operation = get_accounting_operations(financial.class, financial.bank_op_type);
    this.op_types = get_types_of_class(financial.class);
    // console.log('op types changed', this.op_types);
    let total = 0;
    switch (financial.class) {
      case RECORD_CLASS.EXPENSE:
        total = financial.amounts[this.accounting_operation.financial_to_credit!] || 0;
        this.form.controls['total'].disable();
        break;
      case RECORD_CLASS.REVENUE_FROM_MEMBER:
        total = financial.amounts[this.accounting_operation.financial_to_debit!] || 0;
        this.form.controls['total'].disable();
        break;
      case RECORD_CLASS.OTHER_REVENUE:
        total = financial.amounts[this.accounting_operation.financial_to_debit!] || 0;
        this.form.controls['total'].disable();
        break;
      case RECORD_CLASS.MOVEMENT:
        total = financial.amounts[this.accounting_operation.financial_to_debit!] || 0;
        this.form.controls['total'].enable();
        break;
    }

    this.form.patchValue({
      id: financial.id,
      date: financial.date,
      op_class: financial.class,
      op_type: financial.bank_op_type,
      total: total,
      bank_name: financial.cheque_ref?.slice(0, 3),
      cheque_number: financial.cheque_ref?.slice(3),
    });

    this.operations.clear();
    financial.operations.forEach((operation) => {
      if (financial.class === RECORD_CLASS.EXPENSE) {
        this.add_operation(this.expenses_accounts, operation.label!, operation.values, operation.member);
      } else {
        this.add_operation(this.revenues_accounts, operation.label!, operation.values, operation.member);
      }
    });

  };



  onSubmit() {
    console.log('submitted form', this.form.value);
    let operations: Operation[] = [];
    // let op_values: operation_values = {};
    let amounts: bank_values = {};
    let total = 0;
    let accounting_operations = get_accounting_operations(this.op_class, this.form.controls['op_type'].value);


    if ((accounting_operations.class === RECORD_CLASS.OTHER_REVENUE) || (accounting_operations.class === RECORD_CLASS.REVENUE_FROM_MEMBER)) {
      operations = this.operations.controls.map((operation) => {
        let op_values: operation_values = {};
        this.revenues_accounts.forEach((account: string, index: number) => {
          let value = this.parse_to_float((operation as FormGroup).controls['values'].value[index]);
          if (value !== 0) {
            op_values[account] = value;
            total += value;
          }
        });
        return {
          label: (operation as FormGroup).controls['label'].value,
          member: (operation as FormGroup).controls['member'].value,
          values: op_values
        };
      });
    }
    if (accounting_operations.class === RECORD_CLASS.EXPENSE) {
      operations = this.operations.controls.map((operation) => {
        let op_values: operation_values = {};
        this.expenses_accounts.forEach((account: string, index: number) => {
          let value = this.parse_to_float((operation as FormGroup).controls['values'].value[index]);
          if (value !== 0) {
            op_values[account] = value;
            total += value;
          }
        });
        return {
          label: (operation as FormGroup).controls['label'].value,
          member: (operation as FormGroup).controls['member'].value,
          values: op_values
        };
      });
    }
    if (accounting_operations.class === RECORD_CLASS.MOVEMENT) {
      // let value = this.parse_to_float((this.operations.controls[0] as FormGroup).controls['values'].value);
      // if (value !== 0) {
      total = this.parse_to_float(this.form.controls['total'].value);
      // }
    }
    if (accounting_operations.financial_to_debit) amounts[accounting_operations.financial_to_debit] = total;
    if (accounting_operations.financial_to_credit) amounts[accounting_operations.financial_to_credit] = total;


    let booking: Financial = {
      season: season(new Date(this.form.controls['date'].value)),
      date: this.form.controls['date'].value,
      id: this.form.controls['id'].value,
      bank_op_type: this.form.controls['op_type'].value,
      cheque_ref: this.form.controls['bank_name'].value?.toString() + this.form.controls['cheque_number'].value?.toString(),
      amounts: amounts,
      class: this.form.controls['op_class'].value,
      operations: operations
    };

    if (booking.cheque_ref === '') delete booking.cheque_ref;
    // if (booking.operations[0].member === '') delete booking.operations[0].member;


    console.log('financial to save', booking);
    if (this.creation) {
      this.bookService.create_financial(booking).then(() =>
        this.toastService.showSuccessToast('création', 'écriture enregistrée'));
      this.init_form();
    } else {
      booking.id = this.financial_id;
      this.bookService.update_financial(booking).then(() =>
        this.toastService.showSuccessToast('correction', 'écriture modifiée'));
      this.location.back();
    }
  }

  delete() {
    this.bookService.delete_financial(this.financial_id).then(() =>
      this.toastService.showSuccessToast('suppression', 'écriture supprimée'));
    this.location.back();
  }

  cancel() {
    this.location.back();
  }


  // getters


  get op_type(): BANK_OPERATION_TYPE {
    return this.form.get('op_type')?.value;
  }
  get op_class(): RECORD_CLASS {
    return this.form.get('op_class')?.value;
  }
  get operations(): FormArray {
    return this.form.get('operations') as FormArray;
  }

  // utilities

  parse_to_string(value: number): string {
    return value !== undefined ? value.toString() : '';
  }
  parse_to_float(value: string): number {
    return (!Number.isNaN(value) && value !== '') ? parseFloat(value) : 0;
  }

  atLeastOneFieldValidator(control: AbstractControl): ValidationErrors | null {
    const valid = control.value.some((value: string) => value !== '');
    return valid ? null : { atLeastOneFieldRequired: true };
  }
}


