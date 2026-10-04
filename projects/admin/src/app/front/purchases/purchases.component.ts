import { Component } from '@angular/core';
import { BookService } from '../../back/services/book.service';
import { AuthentificationService } from '../../common/authentification/authentification.service';
import { combineLatest, map, Observable, switchMap } from 'rxjs';
import { MembersService } from '../../common/services/members.service';
import { CommonModule } from '@angular/common';
import { TitleService } from '../title/title.service';
import { SystemDataService } from '../../common/services/system-data.service';
import { PurchaseStatementEntry } from '../../common/interfaces/accounting.interface';
import { PurchaseStatementComponent } from '../../common/components/purchase-statement/purchase-statement.component';
import { PurchaseSummaryComponent } from '../../common/components/purchase-summary/purchase-summary.component';



@Component({
  selector: 'app-purchases',
  standalone: true,
  imports: [CommonModule, PurchaseStatementComponent, PurchaseSummaryComponent],
  templateUrl: './purchases.component.html',
  styleUrl: './purchases.component.scss'
})
export class PurchasesComponent {

  member_full_name: string = '';
  purchase_entries: PurchaseStatementEntry[] = [];
  season!: string;
  avoirs: number = 0;
  loading$!: Observable<boolean>;

  constructor(
    private bookService: BookService,
    private auth: AuthentificationService,
    private memberService: MembersService,
    private titleService: TitleService,
    private systemDataService: SystemDataService  
  ) { }

  ngOnInit() {

    this.loading$ = this.bookService.loading$;
    this.season = this.systemDataService.get_season(new Date());

    this.titleService.setTitle('Achats ' + this.season);

    this.auth.logged_member$.pipe(
      map(member => {
        let full_name = member ? this.memberService.full_name(member) : '';
        this.member_full_name = full_name;
        return full_name;
      }),
      switchMap((full_name) => {
        return combineLatest([
          this.bookService.list_book_entries(),
          this.systemDataService.get_configuration(),
        ]).pipe(
          map(([, configuration]) => {
            const productDescriptions = new Map(
              configuration.revenue_and_expense_tree.revenues
                .map(product => [product.key, product.description] as const)
            );
            this.purchase_entries = this.bookService.get_member_purchase_statement(full_name, productDescriptions);
            this.avoirs = this.bookService.find_assets(this.member_full_name);
          })
        );
      }))
      .subscribe(() => {
      });
  }


}
