import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators, Form, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Member } from '../../../../../common/members/member.interface';
import { first, last } from 'rxjs';
import { auth } from '../../../../../../amplify/auth/resource';
import { CommonModule } from '@angular/common';
import { AuthentificationService } from '../../../../../common/authentification/authentification.service';

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
    private auth: AuthentificationService
  ) {


  }
  ngOnInit(): void {
    this.me = this.auth.whoAmI;
  }

}
