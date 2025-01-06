import { CommonModule, formatDate } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { BookService } from '../../book.service';
import { f_Value, Financial, op_Value, OPERATION_CLASS, season, BOOKING_ID } from '../../../../../common/new_sales.interface';
import { Bank } from '../../../../../common/system-conf.interface';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { ToastService } from '../../../../../common/toaster/toast.service';
import { Booking_mapping, get_booking_mapping, get_bookings_of_class } from '../../../../../common/booking.definition';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { Member } from '../../../../../common/member.interface';

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
  members!: Member[];
  expenses_accounts !: string[]; //= Object.values(EXPENSES_ACCOUNTS);
  revenues_accounts !: string[]; //= Object.values(PRODUCTS_ACCOUNTS);

  BOOKING_IDS = BOOKING_ID;
  bookings !: BOOKING_ID[];
  OPERATION_CLASSES = OPERATION_CLASS;
  op_classes = Object.values(OPERATION_CLASS).filter((value) => value !== OPERATION_CLASS.REVENUE_FROM_MEMBER);

  form!: FormGroup;
  show_expenses = true;

  // booking_selected = false;
  selected_booking?: Booking_mapping;

  // operation_type!: OPERATION_TYPE;

  constructor(
    private fb: FormBuilder,
    private bookService: BookService,
    private systemDataService: SystemDataService,
    private membersService: MembersService,
    private toastService: ToastService

  ) {
  }

  ngOnInit() {

    this.systemDataService.configuration$.subscribe((conf) => {
      this.banks = conf.banks;
      this.club_bank = this.banks.find(bank => bank.key === 'AGR')!;
      this.expenses_accounts = conf.charge_accounts.map((account) => account.key);
      this.revenues_accounts = conf.product_accounts.map((account) => account.key);

      this.init_form();
    });
    this.membersService.listMembers().subscribe((members) => {
      this.members = members;
    });

    this.form.controls['op_class'].valueChanges.subscribe((value) => {
      this.selected_booking = undefined!;
      this.form.updateValueAndValidity();

      this.bookings = get_bookings_of_class(value);
      console.log('op types changed', this.bookings);
      if (value === OPERATION_CLASS.MOVEMENT) {
        this.form.controls['total'].enable();
        console.log('total enabled');
      }

    });

    this.form.controls['booking'].valueChanges.subscribe((booking) => {
      // this.booking_selected = true;
      this.selected_booking = get_booking_mapping(booking);

      // pré-remplir le champ label si non touché
      if (this.form.controls['label'].pristine || this.form.controls['label'].value === '')
        this.form.controls['label'].patchValue(booking);

      // gestion des validators pour les champs bank_name et cheque_ref
      this.form.controls['bank_name'].clearValidators();
      this.form.controls['cheque_number'].clearValidators();

      if (booking === BOOKING_ID.cheque_deposit) {
        this.form.controls['bank_name'].addValidators([Validators.required]);
        this.form.controls['cheque_number'].addValidators([Validators.required]);
      } else if (booking === BOOKING_ID.cheque_emit) {
        this.form.controls['cheque_number'].addValidators([Validators.required]);
        this.form.controls['bank_name'].patchValue(this.club_bank.key);
        this.form.controls['bank_name'].disable();
      }
      this.form.controls['bank_name'].updateValueAndValidity();
      this.form.controls['cheque_number'].updateValueAndValidity();
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

  get booking(): BOOKING_ID {
    return this.form.get('booking')?.value;
  }
  get op_class(): OPERATION_CLASS {
    return this.form.get('op_class')?.value;
  }


  init_form() {
    const today = formatDate(new Date(), 'yyyy-MM-dd', 'en');
    this.selected_booking = undefined!;
    this.form = this.fb.group({
      'date': [today, Validators.required],
      'op_class': ['', Validators.required],
      'booking': ['', Validators.required],
      'label': ['', Validators.required],
      'member': [''],
      'total': new FormControl<number>({ value: 0, disabled: true }),
      'values': this.fb.array(this.expenses_accounts.map(field => new FormControl<string>('', Validators.pattern(/^\d+(\.\d+)?$/)))),
      'bank_name': [''],
      'cheque_number': [''],
    });

  }

  onSubmit() {
    console.log(this.form.value);
    let op_values: op_Value = {};
    let amounts: f_Value = {};
    let booking_mapping = get_booking_mapping(this.form.controls['booking'].value);
    if (booking_mapping.financial_to_debit) amounts[booking_mapping.financial_to_debit] = this.form.controls['total'].value;
    if (booking_mapping.financial_to_credit) amounts[booking_mapping.financial_to_credit] = this.form.controls['total'].value;
    if (booking_mapping.class === OPERATION_CLASS.OTHER_REVENUE) {
      this.revenues_accounts.forEach((account: string, index: number) => {
        let value = this.parse_to_float(this.form.controls['values'].value[index]);
        if (value !== 0) op_values[account] = value;
      });
    }
    if (booking_mapping.class === OPERATION_CLASS.EXPENSE) {
      this.expenses_accounts.forEach((account: string, index: number) => {
        let value = this.parse_to_float(this.form.controls['values'].value[index]);
        if (value !== 0) op_values[account] = value;
      });
    }

    let booking: Financial = {
      season: season(new Date(this.form.controls['date'].value)),
      date: this.form.controls['date'].value,
      bank_op_type: this.form.controls['booking'].value,
      cheque_ref: this.form.controls['bank_name'].value?.toString() + this.form.controls['cheque_number'].value?.toString(),
      amounts: amounts,
      class: this.form.controls['op_class'].value,
      operations: [
        {
          label: this.form.controls['label'].value,
          member: this.form.controls['member'].value ?? undefined,
          values: op_values
        }
      ]
    };
    if (booking.cheque_ref === '') delete booking.cheque_ref;
    if (booking.operations[0].member === '') delete booking.operations[0].member;

    console.log(booking);
    this.bookService.create_financial(booking).then(() =>
      this.toastService.showSuccessToast(this.form.controls['label'].value, 'écriture enregistrée')
    );
    this.init_form();
  }


}


