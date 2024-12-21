import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './navbar/navbar.component';
import { ToasterComponent } from '../../../common/toaster/components/toaster/toaster.component';
import { ToastEvent } from '../../../common/toaster/models/toast-event';
import { CommonModule, registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr'; // Import the 'localeFr' variable
import { combineLatest } from 'rxjs';
import { SystemDataService } from '../../../common/services/system-data.service';
import { MembersService } from './members/service/members.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, ToasterComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'admin-dashboard';
  currentToasts: ToastEvent[] = [];
  season !: string;
  init: boolean = false;

  constructor(
    private membersService: MembersService,
    private systemDataService: SystemDataService,
  ) {
    registerLocaleData(localeFr);
    combineLatest([
      this.membersService.listMembers(),
      this.systemDataService.configuration$,

    ]).subscribe(([members, conf]) => {
      // this.season = conf.season;
      // this.bookService.f_list_sales$(this.season).subscribe((sales) => {
      //   this.init = true;
      // });

    });
  }

}
