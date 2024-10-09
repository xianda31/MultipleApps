import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthentificationService } from '../authentification.service';
import { MembersService } from '../../../admin-dashboard/src/app/members/service/members.service';
import { ToastService } from '../../toaster/toast.service';
import { Observable } from 'rxjs';
import { Member } from '../../members/member.interface';

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
  logged_member$: Observable<Member | null> = new Observable<Member | null>();


  constructor(
    private fb: FormBuilder,
    private auth: AuthentificationService,
    private membersService: MembersService,
    private toastService: ToastService,

  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

  }

  ngOnInit() {
    this.logged_member$ = this.auth.logged_member$;

    // this.auth.getCurrentUser().then((id) => {

    //   console.log("id", this.membersService.getMember(id!));

    // });


  }

  signOut() {
    this.auth.signOut();
  }
  // get_current_session() {
  // }




  async signIn() {
    try {
      let member_id = await this.auth.signIn(this.email!.value, this.password!.value)
      if (!member_id) {
        this.toastService.showErrorToast('sign in', 'erreur imprévue');
        return;
      }
    } catch (err: any) {
      console.log("sign in error", err);
    }
  }
}
