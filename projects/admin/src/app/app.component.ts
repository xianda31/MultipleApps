import { registerLocaleData, CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import localeFr from '@angular/common/locales/fr';
import { NavbarComponent } from './navbar/navbar.component';
import { ToasterComponent } from '../../../common/toaster/components/toaster/toaster.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SystemDataService } from '../../../common/services/system-data.service';
import { BookService } from './book.service';
import { catchError, switchMap, tap } from 'rxjs';
import { AuthentificationService } from '../../../common/authentification/authentification.service';
import { GroupService } from '../../../common/authentification/group.service';
import { Group_names, Group_priorities } from '../../../common/authentification/group.interface';
import { ToastService } from '../../../common/toaster/toast.service';



@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, ReactiveFormsModule, NavbarComponent, ToasterComponent, CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {

  season !: string;
  entries_nbr!: number;
  book_entries_loaded: boolean = false;
  accreditation_level: number = -1;

  constructor(
    private systemDataService: SystemDataService,
    private bookService: BookService,
    private auth: AuthentificationService,
    private groupService: GroupService,
  ) {

  }

  ngOnInit(): void {
    registerLocaleData(localeFr);

    localStorage.clear(); // clear local storage on app start

    // chargement de la configuration et des livres de comptes de S3 et dynamoDB
    // toutes les app ont auront besoin ....

    this.systemDataService.get_configuration().pipe(
      tap((conf) => {
        this.season = conf.season;
      }),
      switchMap((conf) => this.bookService.list_book_entries$(conf.season))
    ).subscribe((book_entries) => {
      this.book_entries_loaded = true;
      this.entries_nbr = book_entries.length;
    })
    catchError((err) => {
      console.error('Error loading book entries:', err);
      this.book_entries_loaded = false;
      return [];
    })


    // chargement de l'accréditation

    this.auth.logged_member$.subscribe(async (member) => {
      this.accreditation_level = -1; 
         if (member !== null) {
           let groups = await this.groupService.getCurrentUserGroups();
           if (groups.length > 0) {
            let group = groups[0] as Group_names;
             this.accreditation_level = Group_priorities[group];
           }
         }
       });
  }

}
