import { Injectable } from '@angular/core';
import { Balance_board, Balance_record, Balance_sheet } from '../../../common/balance.interface';
import { FileService } from '../../../common/services/files.service';
import { ToastService } from '../../../common/toaster/toast.service';
import { from, map, catchError, of, Observable, tap, BehaviorSubject, switchMap, combineLatest } from 'rxjs';
import { SystemDataService } from '../../../common/services/system-data.service';
import { BookService } from './book.service';
import { BALANCE_ACCOUNT, BookEntry, CUSTOMER_ACCOUNT, FINANCIAL_ACCOUNT, Operation, TRANSACTION_ID } from '../../../common/accounting.interface';

@Injectable({
  providedIn: 'root'
})
export class FinancialReportService {
  _balance_sheets$: BehaviorSubject<Balance_sheet[]> = new BehaviorSubject<Balance_sheet[]>([]);
  _balance_sheets!: Balance_sheet[];

  constructor(
    private fileService: FileService,
    private toastService: ToastService,
    private systemDataService: SystemDataService,
    private bookService: BookService,


  ) { }


  balance_sheets_upload_to_S3(): Observable<Balance_sheet[]> {
    try {
      let balance_records: Balance_record[] = this._balance_sheets.map((sheet) => {
        const { in_bank_total, wip_total, actif_total, ...record } = sheet;
        return record as Balance_record;
      }
      );
    }
    catch (error) {
      this.toastService.showErrorToast('sauvegarde des bilans', error instanceof Error ? error.message : String(error));
    }
    finally {
      return of(this._balance_sheets);
    }
  }

  save_balance_sheet(balance_sheet: Balance_sheet): Observable<Balance_sheet> {
    const index = this._balance_sheets.findIndex((sheet) => sheet.season === balance_sheet.season);
    if (index !== -1) {
      this._balance_sheets[index] = balance_sheet;
      return this.balance_sheets_upload_to_S3().pipe(
        map(() => {
          this._balance_sheets$.next(this._balance_sheets);
          return balance_sheet;
        })
      );
    } else {
      throw new Error(`Balance sheet for season ${balance_sheet.season} not found`);
    }
  }

  // CRUDL balance_sheet


  read_balance_sheet(season: string): Observable<Balance_sheet> {
    return this.list_balance_sheets().pipe(
      map((data) => {
        const balance_sheet = this._balance_sheets.find((sheet) => sheet.season === season);
        if (balance_sheet) {
          return (balance_sheet);
        } else {
          throw new Error(`Balance sheet for season ${season} not found`);
        }
      }),
      catchError((error) => {
        this.toastService.showErrorToast('read_balance_sheet', error.message);
        return of({} as Balance_sheet);
      })
    );
  }

  get_balance_sheet(season: string): Balance_sheet {
    const balance_sheet = this._balance_sheets.find((sheet) => sheet.season === season);
    if (balance_sheet) {
      return (balance_sheet);
    } else {
      throw new Error(`Balance sheet for season ${season} not found`);
    }
  }


  // update_balance_sheet(balance_sheet: Balance_sheet): Observable<Balance_sheet> {
  //   const index = this._balance_sheets.findIndex((sheet) => sheet.season === balance_sheet.season);
  //   if (index !== -1) {
  //     this._balance_sheets[index] = balance_sheet;
  //     return this.balance_sheets_upload_to_S3().pipe(
  //       map(() => {
  //         this._balance_sheets$.next(this._balance_sheets);
  //         return balance_sheet;
  //       }
  //       ));
  //   } else {
  //     throw new Error(`Balance sheet for season ${balance_sheet.season} not found`);
  //   }
  // }

  // list balance_sheets

  list_balance_sheets(): Observable<Balance_sheet[]> {
    const download_sheets: Observable<Balance_sheet[]> = from(this.fileService.download_json_file('accounting/balance_history.txt')).pipe(
      map((data) => {
        // console.log('balance history downloaded', data);
        let balance_records = data as Balance_record[];
        this._balance_sheets = balance_records.map((record) => {
          let in_bank_total = record.bank + record.savings;
          let cashbox = record.cash + record.client_debts + record.client_assets;
          let wip_total =  record.uncashed_cheques + record.outstanding_expenses + record.gift_vouchers ;
          let actif_total = in_bank_total +  cashbox + wip_total;

          return {
            ...record,
            in_bank_total: record.bank + record.savings,
            wip_total: wip_total,
            cashbox: cashbox,
            actif_total: actif_total,
          } as Balance_sheet;

        });
        if (this.trace_on()) console.log(' balance history from S3', this._balance_sheets);
        return this._balance_sheets;
      }),
      switchMap((sheets) => {
        this._balance_sheets$.next(sheets);
        return this._balance_sheets$.asObservable();
      }),
      catchError((error) => {
        this.toastService.showErrorToast('list_balance_sheets', error.message);
        return of([] as Balance_sheet[]);
      })
    );

    if (this._balance_sheets) {
      if (this.trace_on()) console.log(' balance history from cache', this._balance_sheets);
      return this._balance_sheets$.asObservable();
    }
    else {
      return (download_sheets);
    }
  }


  // methodes finances


  compute_balance_board(season: string): Balance_board {
    let previous_balance_sheet = this.get_balance_sheet(this.previous_season(season));

    let cash = previous_balance_sheet.cash + this.bookService.get_cash_movements_amount();
    let savings = previous_balance_sheet.savings + this.bookService.get_savings_movements_amount();
    let bank = previous_balance_sheet.bank + this.bookService.get_bank_movements_amount();
    let uncashed_cheques = this.bookService.get_uncashed_cheques_amount();
    let outstanding_expenses = -this.bookService.get_bank_outstanding_expenses_amount();
    let gift_vouchers = -this.bookService.get_customers_assets_amount();
    let client_debts = this.bookService.get_clients_debit_value();
    let client_assets = -this.bookService.get_clients_credit_value();
    let in_bank_total = bank + savings;
    let cashbox = cash + client_debts + client_assets;
    let wip_total =  uncashed_cheques  + outstanding_expenses + gift_vouchers ;
    let actif_total = in_bank_total + cashbox +  wip_total;

    let current_balance_sheet = {
      season: season,
      cash: cash,
      bank: bank,
      savings: savings,
      uncashed_cheques: uncashed_cheques,
      outstanding_expenses: outstanding_expenses,
      gift_vouchers: gift_vouchers,
      client_debts: client_debts,
      client_assets: client_assets,
      in_bank_total: bank + savings,
      cashbox : cashbox,
      wip_total: wip_total,
      actif_total: actif_total
    } as Balance_sheet;

    const balance_board: Balance_board = {
      current: current_balance_sheet,
      previous: previous_balance_sheet,
      delta: this._balance_diff(current_balance_sheet, previous_balance_sheet)
    };
    return balance_board;
  }

  _balance_forward(season: string): number {
    let previous_balance_sheet = this._balance_sheets.find((sheet) => sheet.season === this.previous_season(season));
    if (previous_balance_sheet === undefined) {
      throw new Error(`Balance sheet for season ${this.previous_season(season)} not found`);
    }

    return this._actif_net(previous_balance_sheet);
  }

  _actif_net(balance_sheet: Balance_sheet) {
    return balance_sheet.uncashed_cheques + balance_sheet.client_debts + balance_sheet.cash + balance_sheet.bank + balance_sheet.savings - (+balance_sheet.outstanding_expenses + balance_sheet.gift_vouchers);
  }


  _balance_diff(a: Balance_sheet, b: Balance_sheet): Balance_sheet {
    // let balance_sheet = JSON.parse(JSON.stringify(previous_balance_sheet)) as Balance_sheet;
    let diff: Balance_sheet = {
      season: '',
      cash: a.cash - b.cash,
      bank: a.bank - b.bank,
      savings: a.savings - b.savings,
      uncashed_cheques: a.uncashed_cheques - b.uncashed_cheques,
      outstanding_expenses: a.outstanding_expenses - b.outstanding_expenses,
      gift_vouchers: a.gift_vouchers - b.gift_vouchers,
      client_debts: a.client_debts - b.client_debts,
      client_assets: a.client_assets - b.client_assets,
      in_bank_total: a.in_bank_total - b.in_bank_total,
      cashbox: a.cashbox - b.cashbox,
      wip_total: a.wip_total - b.wip_total,
      actif_total: a.actif_total - b.actif_total,
    };

    return diff;
  }

  // import export .txt files
  async import_balance_sheet(file: File) {

    const text = await file.text();
    try {
      this._balance_sheets = JSON.parse(text);
      this._balance_sheets$.next(this._balance_sheets);
      // this.toatService.showSuccessToast('fichier de configuration chargé', 'les données sont prêtes à être enregistrées');
    } catch (error) {
      console.error('error', error);
      // this.toatService.showErrorToast('erreur chargement fichier de configuration', 'vérifiez la syntaxe');
    }
  }







  // utilitaires

  find_balance_sheet(season: string): Balance_sheet | undefined {
    const balance_sheet = this._balance_sheets.find((sheet) => sheet.season === season);
    if (balance_sheet) {
      console.log(' balance found : ', balance_sheet);
      return (balance_sheet);
    } else {
      throw new Error(`Balance sheet for season ${season} not found`);
    }
  }

  previous_season(season: string): string {
    return this.systemDataService.previous_season(season)
  }

  Round(value: number) {
    const neat = +(Math.abs(value).toPrecision(15));
    const rounded = Math.round(neat * 100) / 100;
    return rounded * Math.sign(value);
  }

  private trace_on(): boolean {
    return this.systemDataService.trace_on();
  }
}
