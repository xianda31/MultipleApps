import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../navbar/navbar.component';
import { ToasterComponent } from '../../../../common/toaster/components/toaster/toaster.component';
import { catchError } from 'rxjs';
import { AuthentificationService } from '../../../../common/authentification/authentification.service';
import { GroupService } from '../../../../common/authentification/group.service';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { BookService } from '../services/book.service';
import { LocalStorageService } from '../services/local-storage.service';
import { Group_names, Group_priorities } from '../../../../common/authentification/group.interface';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [RouterModule, ReactiveFormsModule, NavbarComponent, ToasterComponent, CommonModule, FormsModule],
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
    private auth: AuthentificationService,
    private groupService: GroupService,
    private router: Router
  ) {

  }
  ngOnInit(): void {

    console.log('AdminComponent initializing');

    this.systemDataService.get_configuration().subscribe((conf) => {
      this.season = conf.season;
    });

    this.bookService.list_book_entries().subscribe((book_entries) => {
      this.book_entries_loaded = true;
      this.entries_nbr = book_entries.length;
    }),
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
