import { registerLocaleData, CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import localeFr from '@angular/common/locales/fr';
import { NavbarComponent } from './navbar/navbar.component';
import { ToasterComponent } from '../../../common/toaster/components/toaster/toaster.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SystemDataService } from '../../../common/services/system-data.service';
import { BookService } from './book.service';
import { switchMap, tap } from 'rxjs';



@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, ReactiveFormsModule, NavbarComponent, ToasterComponent, CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {

  season !: string;
  entries_nbr!: number ;
  constructor(
    private systemDataService: SystemDataService,
    private bookService: BookService
  ) { 

  }

  ngOnInit(): void {
    registerLocaleData(localeFr);


    this.systemDataService.get_configuration().pipe(
      tap((conf) => this.season = conf.season),
      switchMap((conf) => this.bookService.list_book_entries$(conf.season))
    ).subscribe((book_entries) => {
      this.entries_nbr = book_entries.length;
      // console.log('%s écritures en base pour la saison %s', book_entries.length, this.season);
    });

  }

}
