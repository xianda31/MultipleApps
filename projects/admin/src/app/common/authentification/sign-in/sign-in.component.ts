import { Component } from '@angular/core';
import { AbstractControl, FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { catchError, delay, from, map, Observable, of, switchMap, tap } from 'rxjs';
import { ToastService } from '../../services/toast.service';
import { Process_flow } from '../authentification_interface';
import { Router } from '@angular/router';
import { AuthentificationService } from '../authentification.service';
import { MembersService } from '../../members/services/members.service';
import { GroupService } from '../group.service';
import { Member } from '../../member.interface';
import { Group_icons, Group_names } from '../group.interface';

const EMAIL_PATTERN = "^[_A-Za-z0-9-\+]+(\.[_A-Za-z0-9-]+)*@[A-Za-z0-9-]+(\.[A-Za-z0-9]+)*(\.[A-Za-z]{2,})$";
const PSW_PATTERN = '^(?!\\s+)(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[\\^$*.[\\]{}()?"!@#%&/\\\\,><\': ;| _~`=+-]).{8,256}(?<!\\s)$';
const GROUP_ICONS = Group_icons;

@Component({
  selector: 'app-sign-in',
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.scss',
  standalone: false
})
export class SignInComponent {

  sign_up_sent: boolean = false;
  process_flow = Process_flow;
  show_password: boolean = false;

    logged_member: Member | null = null;
    applying_member: Member | null = null;
    my_group: Group_names | null = null;
      group_icon : string ="bi bi-bug";

  

  mode$: Observable<Process_flow>;
  mode: Process_flow = Process_flow.SIGN_IN;

  loggerForm!: FormGroup;

  get email() { return this.loggerForm.get('email')!; }
  get password() { return this.loggerForm.get('password')!; }
  get code() { return this.loggerForm.get('code')!; }



  constructor(
    private membersService: MembersService,
    private toastService: ToastService,
    private auth: AuthentificationService,
    private router: Router,
    private fb: FormBuilder,
        private groupService: GroupService,
    


  ) {
    this.loggerForm = this.fb.group({
      email: ['', { validators:[Validators.required, Validators.pattern(EMAIL_PATTERN)],  asyncValidators: this.emailValidator }],
      password: ['', [Validators.required, Validators.pattern(PSW_PATTERN)]],
      code: [''],
    });

    this.mode$ = this.auth.mode$;
    this.mode$.subscribe((mode) => {
      this.mode = mode;
    });


    // traiter le cas où l'utilisateur est déjà connecté
  //   this.auth.getCurrentUser()
  //     .then(async (member_id) => {
  //       if (member_id) {
  //         const me = await this.membersService.readMember(member_id);
  //         // this.auth.whoAmI = me;
  //         this.toastService.showSuccess('identification', 'Bonjour ' + me!.firstname);
  //         this.router.navigate(['/']);
  //       }
  //     })
  //     .catch((err) => console.log("err", err));  // pas grave si erreur
  }

   async ngOnInit() {
      this.auth.logged_member$.subscribe(async (member) => {
        this.logged_member = null;
        if (member !== null) {
          // this.toastService.showSuccess('identification', 'Bonjour ' + member.firstname);
          this.logged_member = member;
          let groups = await this.groupService.getCurrentUserGroups();
          if (groups.length > 0) {
            this.my_group = groups[0] as Group_names;
            this.group_icon = GROUP_ICONS[this.my_group];
          }
  
        }
      });
    }

  // async signIn() {
  //   if (this.loggerForm.invalid) return;
  //   try {
  //     let member_id = await this.auth.signIn(this.email.value, this.password.value)
  //     if (!member_id) {
  //       this.toastService.showErrorToast('sign in', 'erreur imprévue');
  //       return;
  //     }
  //     const me = await this.membersService.readMember(member_id);
  //     // this.auth.whoAmI = me;
  //     this.toastService.showSuccess('identification', 'Bonjour ' + me!.firstname);
  //     this.router.navigate(['/']);

  //   } catch (err: any) {
  //     console.log("sign in error", err);
  //   }
  // }

   async signIn() {
    this.auth.signIn(this.email!.value, this.password!.value);
  }

  goSignUp() {
    this.auth.changeMode(Process_flow.SIGN_UP);
  }

  async signUp() {

    if (this.loggerForm.invalid) return;
    let member = await this.membersService.searchMemberByEmail(this.email.value);
    if (!member) {
      this.toastService.showErrorToast('sign up', 'erreur imprévue');
      return;
    } else {      // console.log("member", member);
    }
    await this.auth.signUp(this.email.value, this.password.value, member!.id)
      // .catch((err) => this.toastService.showInfo('sign up', err.message))
      .then(({ isSignUpComplete, nextStep }) => {
        this.sign_up_sent = true;
      })
      .catch((err) => {
        // console.log("sign up error", err);
      });
  }

  async confirmSignUp() {
    if (this.loggerForm.invalid) return;
    await this.auth.confirmSignUp(this.email.value, this.code.value)
      .then(({ isSignUpComplete, nextStep }) => {
        if (!isSignUpComplete) {
          this.toastService.showErrorToast('sign up', 'erreur imprévue');
          return;
        } else {
          this.toastService.showSuccess('création compte', 'compte créé');
          this.membersService.searchMemberByEmail(this.email.value)
            .then((member) => {
              if (!member) {
                this.toastService.showErrorToast('sign up', 'erreur imprévue');
                return;
              } else {
                // member.has_account = true;
                this.membersService.updateMember(member);
                this.toastService.showSuccess('création compte', 'Bienvenue ' + member.firstname);
                this.auth.changeMode(Process_flow.SIGN_IN);
              };
              this.router.navigate(['/']);
            });
        }
      });
  }

  resetPassword() {
    if (this.email.invalid) {
      this.toastService.showWarning('reset mdp', 'adresse mail non valide');
      return;
    }
    this.auth.resetPassword(this.email.value);
  }

  setPassword() {
    this.auth.newPassword(this.email.value, this.code.value, this.password.value);
  }

  signOut() {
    this.auth.signOut();
  }

  emailValidator = (control: AbstractControl): Observable<ValidationErrors | null> => {
    if (!control.value) return of(null);
    if (!control.value.match(EMAIL_PATTERN)) return of(null);
    return of(control.value).pipe(
      switchMap((email) => from(this.membersService.searchMemberByEmail(email))),
      tap((member) => this.applying_member = member),
      map((member) => { return member ? null : { not_member: false }; }),
      catchError((error) => { console.error('Error in emailValidator:', error); return of(null); })
    )
  }
}
