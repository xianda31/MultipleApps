import { Component } from '@angular/core';
import { BookService } from '../../back/services/book.service';
import { AuthentificationService } from '../../common/authentification/authentification.service';
import { map, switchMap } from 'rxjs';
import { MembersService } from '../../common/members/services/members.service';
import { Expense, Revenue } from '../../common/accounting.interface';
import { CommonModule } from '@angular/common';
import { TitleService } from '../title.service';
import { SystemDataService } from '../../common/services/system-data.service';


interface Item {
  type: 'revenue' | 'expense' |'bancaire';
  description: string;
  amount: number;
}

interface Achat_Vente {
  date: string;
  items: Item[];
}

@Component({
  selector: 'app-purchases',
  imports: [CommonModule],
  templateUrl: './purchases.component.html',
  styleUrl: './purchases.component.scss'
})
export class PurchasesComponent {

  member_full_name: string = '';
  achats_ventes !: Achat_Vente[];
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
            let revenues = this.bookService.get_revenues_from_members().filter((revenue) => { return revenue.member === full_name; });
            let expenses = this.bookService.get_expenses_for_members().filter((expense) => { return expense.member === full_name; });
            return {revenues, expenses};
          })
        );
      }))
      .subscribe(({revenues, expenses}) => {
        const achats = revenues.map((operation) => {
          let items: Item[] = Object.entries(operation.values).map(([key, value]: [string, number]) => {
            let type: Item["type"] = (key.startsWith('creance') || key.startsWith('avoir')) ? 'bancaire' : 'revenue';
            return { type: type, description: (this.transform_key(key)), amount: value };
          });
          return { date: operation.date, items : items  };
        });

        const ventes = expenses.map((operation) => {
          let items: Item[] = Object.entries(operation.values).map(([key, value]: [string, number]) => {
            let type: Item["type"] = (key.startsWith('creance') || key.startsWith('avoir')) ? 'bancaire' : 'expense';
            return { type: type, description: (this.transform_key(key)), amount: value };
          });
          return { date: operation.date, items : items  };
        });

        this.achats_ventes = [...achats, ...ventes].sort((b,a) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }
      );
  }

transform_key(key: string): string {    // solution provisoire
    if (key === 'creance_in') {
      return 'achat à crédit';
    } else if (key === 'creance_out') {
      return 'remboursement crédit';
    } else if (key === 'avoir_in') {
      return 'utilisation avoir';
    } else if (key === 'avoir_out') {
      return 'attribution avoir';
    } 
    return key;
  }

}
