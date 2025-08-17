import { Component } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { catchError, from, map, Observable, of, switchMap } from 'rxjs';
import { ToastService } from '../../services/toast.service';
import { Process_flow } from '../authentification_interface';
import { AuthentificationService } from '../authentification.service';
import { MembersService } from '../../services/members.service';
import { Group_icons } from '../group.interface';
import { CommonModule } from '@angular/common';

const EMAIL_PATTERN = "^[_A-Za-z0-9-\+]+(\.[_A-Za-z0-9-]+)*@[A-Za-z0-9-]+(\.[A-Za-z0-9]+)*(\.[A-Za-z]{2,})$";
const PSW_PATTERN = '^(?!\\s+)(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[\\^$*.[\\]{}()?"!@#%&/\\\\,><\': ;| _~`=+-]).{8,256}(?<!\\s)$';
const GROUP_ICONS = Group_icons;

@Component({
  selector: 'app-connexion',
  templateUrl: './connexion.component.html',
  styleUrl: './connexion.component.scss',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
})
export class ConnexionComponent {

  sign_up_sent: boolean = false;
  process_flow = Process_flow;

  logging_msg: string = '';
  signup_msg: string = '';

  mode$!: Observable<Process_flow>;
  // mode: Process_flow = Process_flow.SIGN_IN;

  loggerForm!: FormGroup;

  get email() { return this.loggerForm.get('email')!; }
  get password() { return this.loggerForm.get('password')!; }
  get code() { return this.loggerForm.get('code')!; }

  constructor(
    private membersService: MembersService,
    private toastService: ToastService,
    private auth: AuthentificationService,
    private fb: FormBuilder,

  ) {
    this.loggerForm = this.fb.group({
      email: ['', { validators: [Validators.required, Validators.pattern(EMAIL_PATTERN)], asyncValidators: this.emailValidator }],
      password: ['', [Validators.required, Validators.pattern(PSW_PATTERN)]],
      code: [''],
    });
  }
  
  async ngOnInit() {
        this.mode$ = this.auth.mode$;
    // this.mode$.subscribe((mode) => {
    //   this.mode = mode;
    // });
  }

  async signIn() {
    await this.auth.signIn(this.email!.value, this.password!.value)
      .then((member_id) => {
         if (!member_id) { console.warn('sign in', 'erreur imprévue'); } 
         this.logging_msg ='';
        })
      .catch((err) => {
        this.logging_msg = 'mot de passe/adresse email incorrecte ou compte inexistant';
      });
  }


  goSignUp() {
    this.auth.changeMode(Process_flow.SIGN_UP);
  }

  async signUp() {
    let member = await this.membersService.searchMemberByEmail(this.email.value);
    await this.auth.signUp(this.email.value, this.password.value, member!.id)
      .then(({ isSignUpComplete, nextStep }) => {
        this.sign_up_sent = true;
      })
      .catch((err) => {
        if(err.name !== 'UsernameExistsException') {
          console.warn('sign up erreur imprévue',err);
        }
      });
  }

  async confirmSignUp() {
    if (this.loggerForm.invalid) return;

    await this.auth.confirmSignUp(this.email.value, this.code.value)
      .then(({ isSignUpComplete, nextStep }) => {
        if (!isSignUpComplete) {
          this.toastService.showErrorToast('sign up', 'erreur imprévue');
          this.signup_msg = 'erreur à la confirmation';
          return;
        } else {
          this.toastService.showSuccess('création compte', 'compte créé');
          this.membersService.searchMemberByEmail(this.email.value)
            .then((member) => {
              if (!member) {
                this.toastService.showErrorToast('sign up', 'erreur imprévue');
                return;
              } else {
                this.signup_msg ='';
                this.membersService.updateMember(member);
                this.toastService.showSuccess('création compte', 'Bienvenue ' + member.firstname);
                this.auth.changeMode(Process_flow.SIGN_IN);
              };
            });
        }
      });
  }

  newPassword() {
    this.loggerForm.controls['password'].setValue('');
    this.loggerForm.controls['code'].setValidators([Validators.required]);
    this.auth.changeMode(Process_flow.RESET_PASSWORD);
  }
  resetPassword() {
    this.auth.resetPassword(this.email.value);
  }
  
  confirmPassword() {
    this.auth.newPassword(this.email.value, this.code.value, this.password.value);
  }
  




  emailValidator = (control: AbstractControl): Observable<ValidationErrors | null> => {
    if (!control.value) return of(null);
    if (!control.value.match(EMAIL_PATTERN)) return of(null);
    return of(control.value).pipe(
      switchMap((email) => from(this.membersService.searchMemberByEmail(email))),
      // tap((member) => this.applying_member = member),
      map((member) => { return member ? null : { not_member: false }; }),
      catchError((error) => { console.error('Error in emailValidator:', error); return of(null); })
    )
  }
}
