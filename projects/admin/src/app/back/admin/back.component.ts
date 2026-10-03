import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BackNavbarComponent } from '../back-navbar/back-navbar.component';
import { BreakingNewsDisplayComponent } from '../breaking-news/breaking-news-display.component';
import { ToasterComponent } from '../../common/toaster/components/toaster/toaster.component';
import { map, Observable } from 'rxjs';
import { SystemDataService } from '../../common/services/system-data.service';
import { BookService } from '../services/book.service';
import { LocalStorageService } from '../services/local-storage.service';
import { AccountingSeasonState } from '../../common/services/system-data.service';
import { GroupService } from '../../common/authentification/group.service';
import { Group_priorities } from '../../common/authentification/group.interface';

@Component({
  selector: 'app-back',
  standalone: true,
  imports: [RouterModule, ReactiveFormsModule, BackNavbarComponent, BreakingNewsDisplayComponent, ToasterComponent, CommonModule, FormsModule],
  templateUrl: './back.component.html',
  styleUrls: ['./back.component.scss']
})
export class AdminComponent {
  season$ = new Observable<string>();
  book_entries_number$ = new Observable<number>();
  loading$!: Observable<boolean>;
  accountingSeasonState: AccountingSeasonState | null = null;
  canCloseAccountingSeason = false;


  constructor(
    private systemDataService: SystemDataService,
    private bookService: BookService,
    private localStorageService: LocalStorageService,
    private groupService: GroupService,
  ) {

  }
  ngOnInit(): void {

    this.localStorageService.setItem('entry_point', 'back');

    this.loading$ = this.bookService.loading$;
    this.book_entries_number$ = this.bookService.list_book_entries().pipe(map((entries) => entries.length));

    this.season$ = this.systemDataService.get_configuration().pipe(map((conf) => {
      this.accountingSeasonState = this.systemDataService.get_accounting_season_state();
      return conf.season!;
    }));

    this.groupService.getUserAccreditation()
      .then(accreditation => this.canCloseAccountingSeason = accreditation.level >= Group_priorities.Administrateur)
      .catch(() => this.canCloseAccountingSeason = false);


  }
}
