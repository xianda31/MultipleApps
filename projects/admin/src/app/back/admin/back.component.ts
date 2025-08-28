import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BackNavbarComponent } from '../back-navbar/back-navbar.component';
import { ToasterComponent } from '../../common/toaster/components/toaster/toaster.component';
import { map, Observable } from 'rxjs';
import { SystemDataService } from '../../common/services/system-data.service';
import { BookService } from '../services/book.service';
import { LocalStorageService } from '../services/local-storage.service';

@Component({
  selector: 'app-back',
  standalone: true,
  imports: [RouterModule, ReactiveFormsModule, BackNavbarComponent, ToasterComponent, CommonModule, FormsModule],
  templateUrl: './back.component.html',
  styleUrls: ['./back.component.scss']
})
export class AdminComponent {
  season$ = new Observable<string>();
  book_entries_number$ = new Observable<number>();


  constructor(
    private systemDataService: SystemDataService,
    private bookService: BookService,
    private localStorageService: LocalStorageService,
  ) {

  }
  ngOnInit(): void {

    this.localStorageService.setItem('entry_point', 'back');

    this.book_entries_number$ = this.bookService.list_book_entries().pipe(map((entries) => entries.length));

    this.season$ = this.systemDataService.get_configuration().pipe(map((conf) => conf.season));


  }
}
