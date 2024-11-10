import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-get-newbee',
  standalone: true,
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
      email: ['', [Validators.email]],
      phone: [''],
      city: ['']
    });

  }


  got_it() {

    this.activeModal.close(this.newbee.value);
  }
  close() {
    this.activeModal.close(null);
  }
}
