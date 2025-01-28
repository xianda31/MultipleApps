import { registerLocaleData, CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import localeFr from '@angular/common/locales/fr';
import { NavbarComponent } from './navbar/navbar.component';
import { ToasterComponent } from '../../../common/toaster/components/toaster/toaster.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MembersService } from '../../../admin-dashboard/src/app/members/service/members.service';
import { SystemDataService } from '../../../common/services/system-data.service';
import { combineLatest } from 'rxjs';
import { BookService } from './book.service';



@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, ReactiveFormsModule, NavbarComponent, ToasterComponent, CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {

  init: boolean = false;
  season !: string;
  constructor(
    private membersService: MembersService,
    private systemDataService: SystemDataService,
    private bookService: BookService
  ) {
  }

  ngOnInit(): void {
    registerLocaleData(localeFr);

    combineLatest([
      this.membersService.listMembers(),
      this.systemDataService.configuration$,

    ]).subscribe(([members, conf]) => {
      this.season = conf.season;
      this.bookService.list_book_entries$(this.season).subscribe((sales) => {
        this.init = true;
      });

    });






  }





}
