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



@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, ReactiveFormsModule, NavbarComponent, ToasterComponent, CommonModule, FormsModule, KeypadComponent, CartComponent, BookLoggerComponent, InputMemberComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  [x: string]: any;
  title = 'cashier';
  season = '2024/25';
  double_price = false;


  ngOnInit(): void {
    registerLocaleData(localeFr);
  }





}
