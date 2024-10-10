import { registerLocaleData, CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import localeFr from '@angular/common/locales/fr';
import { KeypadComponent } from "./sales/keypad/keypad.component";
import { NavbarComponent } from './navbar/navbar.component';
import { ToasterComponent } from '../../../common/toaster/components/toaster/toaster.component';
import { CartComponent } from './cart/cart.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { InputMemberComponent } from "./input-member/input-member.component";
import { BookLoggerComponent } from './book-logger/book-logger.component';
import { MembersService } from '../../../admin-dashboard/src/app/members/service/members.service';
import { SystemDataService } from '../../../common/services/system-data.service';



@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, ReactiveFormsModule, NavbarComponent, ToasterComponent, CommonModule, FormsModule, KeypadComponent, CartComponent, BookLoggerComponent, InputMemberComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {

  constructor(
    private membersService: MembersService,
    private systemDataService: SystemDataService,
  ) { }

  ngOnInit(): void {
    registerLocaleData(localeFr);
    // recuperation des membres à ce niveau car ils sont utilisés dans plusieurs composants

    this.membersService.listMembers().subscribe((members) => {
    });

    // récuperation des parametres de configuration
    this.systemDataService.configuration$.subscribe((conf) => {
    });



  }





}
