import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthentificationService } from '../authentification.service';
import { ToastService } from '../../toaster/toast.service';
import { Member } from '../../member.interface';


@Component({
  selector: 'app-admin-in',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './admin-in.component.html',
  styleUrl: './admin-in.component.scss'
})
export class AdminInComponent {

  loginForm !: FormGroup;
  get email() { return this.loginForm.get('email'); }
  get password() { return this.loginForm.get('password') };
  logged_member: Member | null = null;


  constructor(
    private fb: FormBuilder,
    private auth: AuthentificationService,
    private toastService: ToastService,

  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

  }

  ngOnInit() {
    this.auth.logged_member$.subscribe((member) => {
      this.logged_member = null;
      if (member !== null) {
        this.toastService.showSuccessToast('identification', 'Bonjour ' + member.firstname);
        this.logged_member = member;
      }
    });
  }

  signOut() {
    this.auth.signOut();

  }

  async signIn() {
    this.auth.signIn(this.email!.value, this.password!.value);
  }
}
