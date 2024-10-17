import { Component, Input, OnInit, Output } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Payment, PaymentMode, Sale } from '../sales/cart/cart.interface';
import { CurrencyPipe, CommonModule } from '@angular/common';
import { AbstractControl, FormControl, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Bank, SystemConfiguration } from '../../../../../common/system-conf.interface';
import { SystemDataService } from '../../../../../common/services/system-data.service';

@Component({
  selector: 'app-get-payment',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, CurrencyPipe],
  templateUrl: './get-payment.component.html',
  styleUrl: './get-payment.component.scss'
})
export class GetPaymentComponent implements OnInit {
  @Input() sale_in!: Sale;
  @Output() sale_out!: Sale | null;
  saleForm!: FormGroup;
  paymentMode = PaymentMode;
  banks !: Bank[];

  constructor(
    private systemDataService: SystemDataService,
    private activeModal: NgbActiveModal,
  ) { }

  ngOnInit(): void {

    this.systemDataService.configuration$.subscribe((conf) => {
      this.banks = conf.banks;
    });

    this.saleForm = new FormGroup({
      // id: new FormControl(''),
      // season: new FormControl({ value: '', disabled: true }),
      amount: new FormControl({ value: '', disabled: true }),
      payer_id: new FormControl(''),
      sale_mode: new FormControl<PaymentMode>(PaymentMode.CASH, Validators.required),
      bank: new FormControl('', Validators.required),
      cheque_no: new FormControl('', [Validators.pattern(/^\d{6}$/), Validators.required]),
    });

    this.saleForm.patchValue({
      // season: this.sale_in.season,
      amount: this.sale_in.amount,
      payment_mode: PaymentMode.CASH,
      bank: '',
      cheque_no: '',
      payer_id: this.sale_in.payer_id,
    });

    this.sale_out = { ...this.sale_in };

  }

  get payment_mode() { return this.saleForm.get('payment_mode')!; }
  get bank() { return this.saleForm.get('bank')!; }
  get cheque_no() { return this.saleForm.get('cheque_no')!; }


  got_it() {
    this.sale_out = { ...this.sale_in, ...this.saleForm.value };
    console.log(this.sale_out);
    this.activeModal.close(this.sale_out);
  }

  close() {
    this.activeModal.close(null);
  }


}
