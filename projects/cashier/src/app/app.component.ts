import { registerLocaleData, CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import localeFr from '@angular/common/locales/fr';
import { NavbarComponent } from './navbar/navbar.component';
import { ToasterComponent } from '../../../common/toaster/components/toaster/toaster.component';
import { CartComponent } from './shop/cart/cart.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { InputMemberComponent } from "./input-member/input-member.component";
import { MembersService } from '../../../admin-dashboard/src/app/members/service/members.service';
import { SystemDataService } from '../../../common/services/system-data.service';
import { combineLatest } from 'rxjs';
import { KeypadComponent } from './shop/keypad/keypad.component';



@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, ReactiveFormsModule, NavbarComponent, ToasterComponent, CommonModule, FormsModule, KeypadComponent, CartComponent, InputMemberComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {

  init: boolean = false;

  constructor(
    private membersService: MembersService,
    private systemDataService: SystemDataService,
  ) { }

  ngOnInit(): void {
    registerLocaleData(localeFr);

    combineLatest([this.membersService.listMembers(), this.systemDataService.configuration$]).subscribe(([members, conf]) => {
      this.init = true;
    });






  }





}
