import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { normalizeMemberEmail, requiredMemberEmailValidator } from '../../services/member-email.util';

export interface NewMemberFormValue {
  gender: string;
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  city: string;
  acceptMailing: boolean;
}

@Component({
    selector: 'app-get-newbee',
    imports: [CommonModule, FormsModule, ReactiveFormsModule],
    templateUrl: './get-newbee.component.html',
    styleUrl: './get-newbee.component.scss'
})
export class GetNewbeeComponent {
  newbee!: FormGroup;
  constructor(
    private activeModal: NgbActiveModal,
    private formbuilder: FormBuilder
  ) {
    this.newbee = this.formbuilder.group({
      gender: ['', Validators.required],
      firstname: ['', Validators.required],
      lastname: ['', Validators.required],
      email: ['', [requiredMemberEmailValidator]],
      phone: [''],
      city: [''],
      acceptMailing: [false],
    });

  }


  got_it() {
    if (this.newbee.invalid) return;
    const value = this.newbee.getRawValue() as NewMemberFormValue;
    this.activeModal.close({
      ...value,
      email: normalizeMemberEmail(value.email),
    } satisfies NewMemberFormValue);
  }
  close() {
    this.activeModal.close(null);
  }
}
