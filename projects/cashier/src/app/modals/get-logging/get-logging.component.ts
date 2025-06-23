import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastService } from '../../../../../common/toaster/toast.service';
import { AuthentificationService } from '../../../../../common/authentification/authentification.service';
import { delay, from, map, Observable, of, switchMap } from 'rxjs';
import { Member } from '../../../../../common/member.interface';

@Component({
  selector: 'app-get-logging',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './get-logging.component.html',
  styleUrl: './get-logging.component.scss'
})
export class GetLoggingComponent implements OnInit {
  @Input() email: string = '';
  @Input() member !: Member;
  @Input() mode !: 'create_account' | 'reset_password';
  loggingForm!: FormGroup;
  selected_form: string = '';
  show_password: boolean = false;


  constructor(
    private activeModal: NgbActiveModal,
    private formbuilder: FormBuilder,
    private toastService: ToastService,
    private auth: AuthentificationService,

  ) { }

  ngOnInit() {

    this.loggingForm = this.formbuilder.group({
      secret_code: [{ disabled: true, value: '' }, Validators.required],
      password: [{ disabled: false, value: '' }, Validators.required],
    });

  }

  get secret_code() { return this.loggingForm.get('secret_code')!; }
  get password() { return this.loggingForm.get('password')!; }

  resetPassword() {
    this.auth.resetPassword(this.email).then(() => {
      this.toastService.showSuccess('Réinitialisation du mot de passe', 'Demande de code de réinitialisation envoyée ');
      this.secret_code.setValue('');
      this.secret_code.enable();
      this.password.setValue('');
      this.password.enable();
    }).catch((error) => {
      this.toastService.showErrorToast('Erreur de réinitialisation', error.message || 'Une erreur est survenue lors de la réinitialisation du mot de passe.');
    });
  }

  signUp() {
    this.auth.signUp(this.email, this.password.value, this.member.id).then(() => {
      this.toastService.showSuccess('Inscription', 'Demande de compte effectuée. Un email de confirmation a été envoyé.');
      this.secret_code.enable();
    }).catch((error) => {
      this.toastService.showErrorToast('Erreur d\'inscription', error.message || 'Une erreur est survenue lors de la création du compte.');
    });
  }

  got_it() {
    switch (this.mode) {
      case 'reset_password':
        this.auth.resetPassword(this.email);
        break;
      case 'create_account':
        this.auth.confirmSignUp(this.email, this.secret_code.value);
        break;
      default:
        this.toastService.showErrorToast('Erreur', 'Mode non reconnu');
        return;
    }
    this.activeModal.close(this.loggingForm.value);
  }
  close() {
    this.activeModal.close(null);
  }
}

