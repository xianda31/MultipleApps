import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators, Form, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Member } from '../../../../../common/member.interface';
import { first, last } from 'rxjs';
import { auth } from '../../../../../../amplify/auth/resource';
import { CommonModule } from '@angular/common';
import { AuthentificationService } from '../../../../../common/authentification/authentification.service';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';

@Component({
  selector: 'app-personal-data',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './personal-data.component.html',
  styleUrl: './personal-data.component.scss'
})
export class PersonalDataComponent implements OnInit {
  me: Member | null = null;
  constructor(
    private auth: AuthentificationService,
    private membersService: MembersService
  ) {


  }
  ngOnInit(): void {
    this.auth.logged_member$
      .subscribe(async (member) => {
        this.me = member;
      });
    console.log(this.me);
  }

}
