import { registerLocaleData } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import localeFr from '@angular/common/locales/fr';
import { KeypadComponent } from "./keypad/keypad.component";


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, KeypadComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'cashier';


  ngOnInit(): void {

    registerLocaleData(localeFr);
  }
}
