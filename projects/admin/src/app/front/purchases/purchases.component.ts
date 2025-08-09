import { Component } from '@angular/core';
import { BookService } from '../../back/services/book.service';
import { AuthentificationService } from '../../common/authentification/authentification.service';
import { map, switchMap } from 'rxjs';
import { MembersService } from '../../common/services/members.service';
import { CommonModule } from '@angular/common';
import { TitleService } from '../title.service';
import { SystemDataService } from '../../common/services/system-data.service';
import { Formatted_purchase } from '../../common/interfaces/accounting.interface';



@Component({
  selector: 'app-purchases',
  imports: [CommonModule],
  templateUrl: './purchases.component.html',
  styleUrl: './purchases.component.scss'
})
export class PurchasesComponent {

  member_full_name: string = '';
  achats_ventes !: Formatted_purchase[];
  season: string = '2023-2024'; // This should be dynamic based on the current season

  constructor(
    private bookService: BookService,
    private auth: AuthentificationService,
    private memberService: MembersService,
    private titleService: TitleService,
    private systemDataService: SystemDataService  
  ) { }

  ngOnInit() {

    this.season = this.systemDataService.get_season(new Date());

    this.titleService.setTitle('Achats ' + this.season);

    this.auth.logged_member$.pipe(
      map(member => {
        let full_name = member ? this.memberService.full_name(member) : '';
        this.member_full_name = full_name;
        return full_name;
      }),
      switchMap((full_name) => {
        return this.bookService.list_book_entries().pipe(
          map(entries => {
            this.achats_ventes = this.bookService.get_formated_buy_operations(full_name);
          })
        );
      }))
      .subscribe(() => {
      });
  }


}
