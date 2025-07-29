import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BackNavbarComponent } from '../navbar/back-navbar.component';
import { ToasterComponent } from '../../common/toaster/components/toaster/toaster.component';
import { catchError } from 'rxjs';
import { SystemDataService } from '../../common/services/system-data.service';
import { BookService } from '../services/book.service';
import { LocalStorageService } from '../services/local-storage.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [RouterModule, ReactiveFormsModule, BackNavbarComponent, ToasterComponent, CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent {
  season !: string;
  entries_nbr!: number;
  book_entries_loaded: boolean = false;
  accreditation_level: number = -1;

  constructor(
    private systemDataService: SystemDataService,
    private bookService: BookService,
    private localStorageService: LocalStorageService,
  ) {

  }
  ngOnInit(): void {

    this.localStorageService.setItem('entry_point', 'front');

    this.systemDataService.get_configuration().subscribe((conf) => {
      this.season = conf.season;
    });

    this.bookService.list_book_entries()
      .pipe(
        catchError((err) => {
          console.error('Error loading book entries:', err);
          this.book_entries_loaded = false;
          return [];
        })
      )
      .subscribe((book_entries) => {
        this.book_entries_loaded = true;
        this.entries_nbr = book_entries.length;
      });


  }
}
