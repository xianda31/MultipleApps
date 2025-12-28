

import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { InputMemberComponent } from '../../back/input-member/input-member.component';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { SystemDataService } from '../../common/services/system-data.service';
import { MembersService } from '../../common/services/members.service';
import { Bank } from '../../common/interfaces/system-conf.interface';
import { PaymentMode } from '../../back/shop/cart/cart.interface';
import { Member } from '../../common/interfaces/member.interface';

@Component({
  selector: 'app-quick-card-sale',
  templateUrl: './quick-card-sale.component.html',
  styleUrls: ['./quick-card-sale.component.scss'],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, InputMemberComponent],
  standalone: true
})
export class QuickCardSaleComponent {
    getConfirmDisabledReason(): string {
      const mode = this.form.get('mode')?.value;
      const bank = this.form.get('bank')?.value;
      const chequeNo = this.form.get('chequeNo')?.value;
      const cartePartagee = this.form.get('cartePartagee')?.value;
      const coTitulaire = this.form.get('coTitulaire')?.value;
      if (!mode) return 'Veuillez sélectionner un mode de paiement.';
      if (mode === this.paymentMode.CHEQUE) {
        if (!bank) return 'Veuillez sélectionner une banque.';
        if (!chequeNo) return 'Veuillez saisir le numéro de chèque.';
      }
      if (cartePartagee && !coTitulaire) return 'Veuillez définir le co-titulaire, ou décocher le partage de carte.';
      return '';
    }
  @Input() titulaire!: Member ;
  static modalOptions = {
    backdrop: 'static',
    keyboard: false
  };
  paymentMode = PaymentMode;
  banks: Bank[] = [];
  members: Member[] = [];

  form;

  constructor(
    private membersService: MembersService,
    private systemDataService: SystemDataService,
    private fb: FormBuilder,
    public activeModal: NgbActiveModal
  ) {
    this.form = this.fb.group({
      titulaire: [this.titulaire as Member ],
      cartePartagee: [true],
      coTitulaire: [null],
      mode: ['' , [Validators.required]],
      bank: [''],
      chequeNo: [''],
      
    });
    this.membersService.listMembers().subscribe(members => {
      this.members = members;
    });
    this.systemDataService.get_configuration().subscribe(conf => {
      this.banks = conf.banks || this.banks;
    });
  }

  ngOnInit() {
    if (this.titulaire) {
      this.form.get('titulaire')?.setValue(this.titulaire );
    }
    // Validators conditionnels pour le paiement par chèque
    this.form.get('mode')!.valueChanges.subscribe(mode => {
      if (mode === PaymentMode.CHEQUE) {
        this.form.get('bank')!.setValidators([Validators.required]);
        this.form.get('chequeNo')!.setValidators([Validators.required]);
      } else {
        this.form.get('bank')!.clearValidators();
        this.form.get('chequeNo')!.clearValidators();
      }
      this.form.get('bank')!.updateValueAndValidity();
      this.form.get('chequeNo')!.updateValueAndValidity();
    });
  }

  confirm(answer: boolean) {
    if (answer && this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.activeModal.close(answer ? this.form.value : null);
  }

  get shared(): boolean {
    return !!this.form.get('cartePartagee')?.value;
  }

    get isConfirmDisabled(): boolean {
    const mode = this.form.get('mode')?.value;
    const bank = this.form.get('bank')?.value;
    const chequeNo = this.form.get('chequeNo')?.value;
    const cartePartagee = this.form.get('cartePartagee')?.value;
    const coTitulaire = this.form.get('coTitulaire')?.value;
    if (!mode) return true;
    if (mode === this.paymentMode.CHEQUE && (!bank || !chequeNo)) return true;
    if (cartePartagee && !coTitulaire) return true;
    return false;
  }
}
