import { Component, Input, OnInit, Output } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Bank_names, Payment, PaymentMode } from '../../cart/cart.interface';
import { CurrencyPipe, CommonModule } from '@angular/common';
import { AbstractControl, FormControl, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

@Component({
  selector: 'app-get-payment',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, CurrencyPipe],
  templateUrl: './get-payment.component.html',
  styleUrl: './get-payment.component.scss'
})
export class GetPaymentComponent implements OnInit {
  @Input() payment_in!: Payment;
  // @Input() buyer_fullname!: string;
  @Output() payment_out!: Payment | null;
  paymentForm!: FormGroup;
  paymentMode = PaymentMode;
  bank_names = Bank_names;

  constructor(
    private activeModal: NgbActiveModal,

  ) { }

  ngOnInit(): void {

    this.paymentForm = new FormGroup({
      // id: new FormControl(''),
      // season: new FormControl({ value: '', disabled: true }),
      amount: new FormControl({ value: '', disabled: true }),
      payer_id: new FormControl(''),
      payment_mode: new FormControl<PaymentMode>(PaymentMode.CASH, Validators.required),
      bank: new FormControl('', Validators.required),
      cheque_no: new FormControl('', [Validators.pattern(/^\d{6}$/), Validators.required]),
    });

    this.paymentForm.patchValue({
      // season: this.payment_in.season,
      amount: this.payment_in.amount,
      payment_mode: PaymentMode.CASH,
      bank: '',
      cheque_no: '',
      payer_id: this.payment_in.payer_id,
    });

    this.payment_out = { ...this.payment_in };

  }

  get payment_mode() { return this.paymentForm.get('payment_mode')!; }
  get bank() { return this.paymentForm.get('bank')!; }
  get cheque_no() { return this.paymentForm.get('cheque_no')!; }


  got_it() {
    this.payment_out = { ...this.payment_in, ...this.paymentForm.value };
    console.log(this.payment_out);
    this.activeModal.close(this.payment_out);
  }

  close() {
    this.activeModal.close(null);
  }


}
