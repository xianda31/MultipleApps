import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { AuthentificationService } from '../authentification.service';
import { ToastService } from '../../toaster/toast.service';
import { Member } from '../../member.interface';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { GetLoggingComponent } from '../../../admin/src/app/modals/get-logging/get-logging.component';
import { Observable, of, switchMap, from, map, tap, catchError } from 'rxjs';
import { GroupService } from '../group.service';
import { Group_icons, Group_names } from '../group.interface';
import { MembersService } from '../../members/services/members.service';

const EMAIL_PATTERN = '^[\\w.-]+@[A-Za-z0-9-]+\\.[A-Za-z]{2,}(\\.[A-Za-z]{2,})*$';
const GROUP_ICONS = Group_icons;

@Component({
    selector: 'app-admin-in',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FormsModule],
    templateUrl: './admin-in.component.html',
    styleUrl: './admin-in.component.scss'
})
export class AdminInComponent {



  loginForm !: FormGroup;
  logged_member: Member | null = null;
  applying_member: Member | null = null;
  my_group: Group_names | null = null;
  group_icon : string ="bi bi-bug";
  show_password: boolean = false;


  constructor(
    private fb: FormBuilder,
    private auth: AuthentificationService,
    private groupService: GroupService,
    private toastService: ToastService,
    private modalService: NgbModal,
    private membersService: MembersService


  ) {
    this.loginForm = this.fb.group({
      username: [''],
      email: ['',
        {
          validators: [Validators.required, Validators.email],
          asyncValidators: this.emailValidator,
        }],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
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
  get email() { return this.loginForm.get('email')!; }
  get password() { return this.loginForm.get('password') };

  signOut() {
    sessionStorage.clear();
    this.logged_member = null;
    this.auth.signOut();
  }

  async signIn() {
    this.auth.signIn(this.email!.value, this.password!.value);
  }

  async signUp() {
    if (this.applying_member) {
const modalRef = this.modalService.open(GetLoggingComponent, { centered: true });
    modalRef.componentInstance.email = this.email.value;
    modalRef.componentInstance.member = this.applying_member;
    modalRef.componentInstance.mode = 'create_account';
    modalRef.result.then((response: any) => {
      });
      
    } else {
      this.toastService.showErrorToast('Création compte', 'Mel non répertorié dans la base de données adhérents');
    }
  }
  
  resetPassword() {
    // this.show_login = false;
    const modalRef = this.modalService.open(GetLoggingComponent, { centered: true });
    modalRef.componentInstance.email = this.email.value;
    modalRef.componentInstance.member = this.applying_member;
    modalRef.componentInstance.mode = 'reset_password';
    modalRef.result.then((response: any) => {
    });
  }

  emailValidator = (control: AbstractControl): Observable<ValidationErrors | null> => {
    if (!control.value) return of(null);
    if (!control.value.match(EMAIL_PATTERN)) return of(null);
    return of(control.value).pipe(
      switchMap((email) => from(this.membersService.searchMemberByEmail(email))),
      tap((member) => this.applying_member = member),
      map((member) => { return member ? null : { not_member: false }; }),
      catchError((error) => {console.error('Error in emailValidator:', error); return of(null); })
    )
  }

}