import { Component, Output, Input } from '@angular/core';
import { Financial } from '../../../../common/new_sales.interface';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule, formatDate } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { PaymentMode } from '../shop/cart/cart.interface';

@Component({
  selector: 'app-booking-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './booking-edit.component.html',
  styleUrl: './booking-edit.component.scss'
})
export class BookingEditComponent {
  @Input() booking_in!: Financial;
  @Output() booking_out!: Financial | null;
  form!: FormGroup;


  constructor(
    private fb: FormBuilder,
    private systemDataService: SystemDataService,
    private activeModal: NgbActiveModal,
  ) { }

  ngOnInit(): void {
    console.log(this.booking_in);

    this.systemDataService.configuration$.subscribe((conf) => {
      // this.banks = conf.banks;
    });

    this.init_form();
    this.form.patchValue(this.booking_in);


    this.booking_out = { ...this.booking_in };

  }

  init_form() {
    const today = formatDate(new Date(), 'yyyy-MM-dd', 'en');
    this.form = this.fb.group({
      'date': [today, Validators.required],
      'class': ['', Validators.required],
      'bank_op_type': ['', Validators.required],
      'label': ['', Validators.required],
      'member': [''],
      'total': new FormControl<number>({ value: 0, disabled: true }),
      // 'values': this.fb.array(this.expenses_accounts.map(field => new FormControl<string>('', Validators.pattern(/^\d+(\.\d+)?$/)))),
      'bank_name': [''],
      'cheque_number': [''],
    });

  }
  got_it() {
    this.booking_out = { ...this.booking_in, ...this.form.value };
    console.log(this.booking_out);
    this.activeModal.close(this.booking_out);
  }

  close() {
    this.activeModal.dismiss();
  }

}
