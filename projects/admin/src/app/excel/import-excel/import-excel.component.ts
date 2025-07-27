import { Component, ElementRef, signal } from '@angular/core';
import * as ExcelJS from 'exceljs';
import { EXPENSES_COL, EXTRA_CUSTOMER_IN, EXTRA_CUSTOMER_OUT, FINANCIAL_COL, MAP, PRODUCTS_COL, TRANSACTION_ID_TO_NATURE } from '../../../../../common/excel/excel.interface';
import { TRANSACTION_ID, BookEntry, FINANCIAL_ACCOUNT, operation_values, Operation, BALANCE_ACCOUNT } from '../../../../../common/accounting.interface';
import { Member } from '../../../../../common/member.interface';
import { BookService } from '../../book.service';
import { CommonModule, formatDate } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { Transaction, TRANSACTION_CLASS } from '../../../../../common/transaction.definition';
import { TransactionService } from '../../transaction.service';
import { Revenue_and_expense_definition } from '../../../../../common/system-conf.interface';
import { json } from 'd3';
import { MembersService } from '../../../../../common/members/service/members.service';

@Component({
  selector: 'app-import-excel',
  imports: [CommonModule, FormsModule],
  templateUrl: './import-excel.component.html',
  styleUrl: './import-excel.component.scss'
})


export class ImportExcelComponent {
  onFileSelect($event: Event) {
    throw new Error('Method not implemented.');
  }
  workbook!: ExcelJS.Workbook;
  worksheet !: ExcelJS.Worksheet;
  worksheets!: ExcelJS.Worksheet[];

  book_entries: BookEntry[] = [];
  revenue_definitions: Revenue_and_expense_definition[] = [];
  expense_definitions: Revenue_and_expense_definition[] = [];
  op_value_keys: string[] = [];
  financial_accounts = Object.values(FINANCIAL_ACCOUNT).concat(Object.values(BALANCE_ACCOUNT) as unknown as FINANCIAL_ACCOUNT[]);

  members: Member[] = [];
  current_season: string = '';
  // worksheet_processed: boolean = false;
  verbose = signal<string>('');
  progress_style = 'width: 0%';
  create_progress = 0;
  data_uploading = false;
  loadable = false;

  balise999: string = '';

  constructor(
    private bookService: BookService,
    private transactionService: TransactionService,
    private membersService: MembersService,
    private systemDataService: SystemDataService,
  ) {


    this.systemDataService.get_configuration().subscribe((configuration) => {
      this.current_season = configuration.season;
      let revenue_keys = configuration.revenue_and_expense_tree.revenues.map((revenue) => revenue.key);
      let expense_keys = configuration.revenue_and_expense_tree.expenses.map((expense) => expense.key);
      this.op_value_keys = [...revenue_keys, ...expense_keys, ...Object.keys(EXTRA_CUSTOMER_IN), ...Object.keys(EXTRA_CUSTOMER_OUT)];;
    });

    this.membersService.listMembers().subscribe((members) => {
      this.members = members;
    });

  }

  onFileChange(event: any) {
    // this.worksheet_processed = false;
    this.worksheets = [];
    const file = event.target.files[0];
    this.verbose.set('lecture du fichier ' + file.name + ' ...\n');
    this.book_entries = [];
    this.progress_style = 'width: 0%';
    this.create_progress = 0;
    this.data_uploading = false;
    let workbook = new ExcelJS.Workbook();
    workbook.xlsx.load(file).then((workbook) => {
      this.workbook = workbook;
      this.worksheets = workbook.worksheets;
    })
      .catch((error) => {
        console.log('error', error);
      });
  }

  clear_verbose() {
    this.verbose.set('');
  }

  select_sheet() {
    let processed_ok = this.process_exel_file(this.worksheet);
    if (!processed_ok) {
      this.verbose.set(this.verbose() + 'traitement de données arrété \n');
      return;
    }
    this.loadable = this.extra_sanity_check();
    // this.worksheet_processed = true;
  }

  process_exel_file(worksheet: ExcelJS.Worksheet): boolean {


    let is_valid_data = (chrono: string): boolean => {
      return (chrono.length === 4 && (['B', 'C', 'K'].includes(chrono.slice(0, 1))))
    }

    this.worksheet = worksheet;
    this.verbose.set('\n traitement de l\'onglet "' + this.worksheet.name + '" \n');
    this.book_entries = [];

    // recherche balise ?999

    let cell_999 = this.worksheet.getColumn(MAP.chrono).values.find((cell) => cell && cell.toString().endsWith('999'));
    if (!cell_999) {
      console.log('balise 999 non trouvée');
      this.verbose.set('balise 999 non trouvée' + ' ...\n');
      return false;
    }
    this.balise999 = cell_999.toString();


    // filtrage des lignes à traiter (balise 999, mois comptable, cellules mergées)

    let meta_rows: { [master: string]: string[] } = {};
    let col_nature = this.worksheet.getColumn(MAP.nature);

    // recherche des cellules mergées (colonne Nature) => meta_rows

    let _999reached = false;
    col_nature.eachCell((cell, rowNumber) => {
      if (_999reached) return;

      let cell_chrono = this.worksheet.getCell(MAP.chrono + rowNumber).toString();
      let cell_month = this.worksheet.getCell(MAP.mois + rowNumber).toString();

      // tant que la balise 999 n'est pas atteinte, on traite les cellules de la colonne Nature
      if (cell_chrono === this.balise999) {
        this.verbose.set(this.verbose() + ' (info) : ligne [' + rowNumber + '] balise 999 atteinte \n');
        _999reached = true; // set flag to stop further processing
        return;
      }

      if (!is_valid_data(cell_chrono)) {
        this.verbose.set(this.verbose() + ' (info) : ligne [' + rowNumber + '] chrono :<' + cell_chrono + '> ignorée \n');
      } else {

        // si le mois finit en N-1 ou N-2, on ignore la ligne
        if (cell_month.endsWith('N-1') || cell_month.endsWith('N-2')) {
          this.verbose.set(this.verbose() + ' (info) : ligne [' + rowNumber + '] mois comptable :<' + cell_month + '> ignorée \n');
        } else {

          if (cell.isMerged) {
            let merge = cell.master.address;
            if (meta_rows[merge]) {
              meta_rows[merge].push(cell.address);
            } else {
              meta_rows[merge] = [cell.address];
            }
          } else {
            if (meta_rows[cell.address]) {
              meta_rows[cell.address].push(cell.address);
            } else {
              meta_rows[cell.address] = [cell.address];
            }
          }
        }
      }
    });



    // traitement lignes du tableau meta_rows (bloc de cellules mergées)
    let error = false;
    Object.entries(meta_rows).forEach(([master, cells]) => {
      let entry = this.convert_to_book_entry(master, cells)
      if (entry === null) {
        this.verbose.set(this.verbose() + 'erreur de conversion ligne ' + this.worksheet.getCell(master).row + '\n');
        error = true;
        return;
      }
      this.book_entries.push(entry);
      // this.verbose.set(this.verbose() + '.');
    });

    return !error;
  }



  upload_data() {

    let progress = (index: number) => {
      this.create_progress = Math.round((index) / this.book_entries.length * 100);
      this.progress_style = 'width: ' + this.create_progress + '%';
      if (index === this.book_entries.length) {
        this.data_uploading = false;
        this.verbose.set(this.verbose() + '... terminé \n');
      }
    }

    this.data_uploading = true;

    this.verbose.set(this.verbose() + 'uploading ...');

    this.bookService.book_entries_bulk_create$(this.book_entries).subscribe((number) => {
      progress(number);
    });
  }

  extra_sanity_check(): boolean {

    let loadable = true;

    // check all book entries have a valid transaction id
    this.verbose.set(this.verbose() + 'vérification des écritures \n');
    this.book_entries.forEach((book_entry, index) => {
      if (book_entry.transaction_id === undefined || book_entry.transaction_id === null) {
        this.verbose.set(this.verbose() + '~[' + index + '] ' + 'transaction id non renseigné \n');
        loadable = false;
      }
    });


    // check all book entries operation.values have known keys
    this.verbose.set(this.verbose() + 'vérification des opérations \n');
    this.book_entries.forEach((book_entry, index) => {
      book_entry.operations.forEach((operation, index_op) => {
        Object.keys(operation.values).forEach((key) => {
          if (!this.op_value_keys.includes(key)) {
            console.log(' unknown %s within \n %s ', key, JSON.stringify(book_entry));
            this.verbose.set(this.verbose() + '~[' + index + '][' + index_op + '] ' + 'clé inconnue : ' + key + '\n');
            loadable = false;
          }
        });
      });
    });

    // checks all book entries amounts have known keys

    this.verbose.set(this.verbose() + 'vérification des montants \n');
    this.book_entries.forEach((book_entry, index) => {
      Object.keys(book_entry.amounts).forEach((key) => {
        if (!this.financial_accounts.includes(key as FINANCIAL_ACCOUNT)) {
          console.log(' unknown %s within \n %s ', key, JSON.stringify(book_entry));
          this.verbose.set(this.verbose() + '~[' + index + '] ' + 'clé inconnue : ' + key + '\n');
          loadable = false;
        }
      });
    });


    // check if no book entry has a bank deposit ref starting with 'temp_'
    this.verbose.set(this.verbose() + 'vérification des références de dépôt \n');
    this.book_entries.forEach((book_entry, index) => {
      if (book_entry.deposit_ref?.startsWith('temp_')) {
        this.verbose.set(this.verbose() + '~[' + index + '] ' + 'référence de dépôt temporaire : ' + book_entry.deposit_ref + '\n');
        loadable = false;
      }
    });

    // check if dates are within season
    this.verbose.set(this.verbose() + 'vérification des dates \n');
    this.book_entries.forEach((book_entry, index) => {
      let date = new Date(book_entry.date).toISOString().slice(0, 10);
      if (!this.systemDataService.date_in_season(date, this.current_season)) {
        this.verbose.set(this.verbose() + '~[' + index + '] ' + 'date hors saison : ' + book_entry.date + '\n');
        loadable = false;
      }
    });

    if (loadable) {
      this.verbose.set(this.verbose() + '\n ☑ toutes les écritures sont valides \n');
    }
    else {
      this.verbose.set(this.verbose() + '\n ❌ veuillez corriger les erreurs détectées \n');
    }
    return loadable;
  }


  show_data() {
    this.verbose.set(this.verbose() + 'viewing .. \n');
    this.book_entries.forEach((book_entry, index) => {
      this.verbose.set(this.verbose() + index.toString() + JSON.stringify(book_entry) + '\n');
    });
  }


  convert_to_book_entry(master: string, cells: string[]): BookEntry | null {

    // let promise = new Promise<BookEntry>((resolve, reject) => {
    // initializing book_entry
    let row_number = +this.worksheet.getCell(master).row;
    let master_row = this.worksheet.getRow(row_number);
    let date = master_row.getCell(MAP.date).value?.toString() || '';
    let cell_pointage = master_row.getCell(MAP['pointage']).value?.toString() || undefined;

    let cell_chrono = master_row.getCell(MAP.chrono).value?.toString() || '';

    let cell_chèque = master_row.getCell(MAP['n° chèque']).value;
    let cell_bordereau = master_row.getCell(MAP['bordereau']).value;
    let cell_info_sup = master_row.getCell(MAP['info']).value;

    let cell_nature = master_row.getCell(MAP['nature']).value;
    let bank_op_type = this.convert_to_bank_op_type(cell_chrono, cell_nature?.toString() as string);
    if (bank_op_type === null) {
      // console.log('erreur de nature', cell_nature);
      // reject('erreur de nature ' + cell_nature);
      return (null);
    }
    let transaction = this.transactionService.get_transaction(bank_op_type)

    let book_entry: BookEntry = {
      season: this.systemDataService.get_season(new Date(date)),
      date: formatDate(new Date(date), 'yyyy-MM-dd', 'en'),
      id: '',
      amounts: {},
      operations: [],
      transaction_id: bank_op_type,
      bank_report: (cell_pointage) ? this.format_bank_report(cell_pointage.toString(), this.current_season) : undefined,

    };
    if (cell_info_sup?.toString()) { //}.startsWith('#')) {
      book_entry.tag = cell_info_sup?.toString() as string;
    }

    if (cell_chèque?.toString() && transaction.cheque !== 'none') { book_entry.cheque_ref = cell_chèque?.toString() as string; }
    if (cell_bordereau?.toString()) { book_entry.deposit_ref = cell_bordereau?.toString() as string; }

    // book_entry.amounts

    Object.entries(FINANCIAL_COL).forEach((entry) => {
      let [name, col] = entry;
      let cell = master_row.getCell(col).value;
      if (!cell?.valueOf()) { return; }
      book_entry.amounts[name as FINANCIAL_ACCOUNT] = cell.valueOf() as number;
    });


    // construct products operation side

    cells.forEach((cell) => {
      let row_number = +this.worksheet.getCell(cell).row;
      let row = this.worksheet.getRow(row_number);

      let operation = this.compute_operation_values(transaction, row);

      if (operation === null) {
        console.log('operation translation went wrong', row_number);
        // reject('operation translation went wrong');
        // return (null);
      } else {
        book_entry.operations.push(operation);
      }
    });

    if (!this.control_amounts_balance(row_number, book_entry)) {
      return (null) // reject('amounts not balanced');
    } else {
      return (book_entry);
    }
  }

  format_bank_report(pointage: string, season: string): string | null {

    return pointage;

    // convert R007 to bank_reports[0] ... R012 to bank_reports[5] ... R101 to bank_reports[6] ...R106 to bank_reports[11]
    // let month: number = +pointage.slice(2, 4);
    // console.log('pointage : %s month %s', pointage, month);
    // if (month < 1 || month > 12) return null;
    // let Y = season.slice(0, 4).slice(-2); // yyYY-zzZZ
    // let Z = season.slice(5, 9).slice(-2); // yyYY-zzZZ
    // switch (pointage.slice(0, 2)) {
    //   case 'R0':
    //     return Y + '-' + month.toString().padStart(2, '0')
    //   case 'R1':
    //     return Z + '-' + month.toString().padStart(2, '0')
    //   default:
    //     return null;
    // }

  }

  convert_to_bank_op_type(chrono: string, nature: string): TRANSACTION_ID | null {

   const transactionId = (Object.keys(TRANSACTION_ID_TO_NATURE) as Array<keyof typeof TRANSACTION_ID_TO_NATURE>)
  .find(key => TRANSACTION_ID_TO_NATURE[key] === nature) as TRANSACTION_ID | undefined;

    

    let wk_type = chrono.slice(0, 1);
    switch (wk_type) {
      case 'B':  // type chrono banque

        switch (nature) {
          case 'report prélèvement':
            return TRANSACTION_ID.report_prélèvement;
          case 'report chèque':
            return TRANSACTION_ID.report_chèque;
          case 'report avoir':
            return TRANSACTION_ID.report_avoir;
          case 'versement espèces':
            return TRANSACTION_ID.dépôt_collecte_espèces;
          case 'fond en espèces':
            return TRANSACTION_ID.dépôt_collecte_espèces;
          case 'versement chèques':
            return TRANSACTION_ID.dépôt_collecte_chèques;
          case 'remise espèces':
            return TRANSACTION_ID.dépôt_caisse_espèces;
          case 'remise chèques':
            return TRANSACTION_ID.dépôt_caisse_chèques;
          case 'vente en espèces':
            return TRANSACTION_ID.vente_en_espèces;
          case 'vente par chèque': // pas adhérent , attention
            return TRANSACTION_ID.vente_par_chèque;
          case 'chèque émis':
            return TRANSACTION_ID.dépense_par_chèque;
          case 'attribution_avoir':
            return TRANSACTION_ID.attribution_avoir;
          case 'virement reçu':
            return TRANSACTION_ID.vente_par_virement;
          case 'achat en espèces':
            return TRANSACTION_ID.dépense_en_espèces;
          case 'virement émis':
            return TRANSACTION_ID.dépense_par_virement;
          case 'prélèvement':
            return TRANSACTION_ID.dépense_par_prélèvement;
          case 'carte':
            return TRANSACTION_ID.dépense_par_carte;
          case 'versement compte épargne':
            return TRANSACTION_ID.virement_banque_vers_épargne;
          case 'versement épargne':
            return TRANSACTION_ID.virement_banque_vers_épargne;
          case 'retrait épargne':
            return TRANSACTION_ID.retrait_épargne_vers_banque;
          case 'intérêts':
            return TRANSACTION_ID.intérêt_épargne;
          default:
            console.log('erreur de nature', nature);
            return null
        }

      case 'C': // type 'chrono vente':

        switch (nature) {
          case 'report avoir':
            return TRANSACTION_ID.report_avoir;
          case 'virement reçu':
            return TRANSACTION_ID.achat_adhérent_par_virement;
          case 'paiement par chèque':
            return TRANSACTION_ID.achat_adhérent_par_chèque;
          case 'paiement en espèces':
            return TRANSACTION_ID.achat_adhérent_en_espèces;
          case 'attribution avoir':
            return TRANSACTION_ID.attribution_avoir;
          case 'remboursement par chèque':
            return TRANSACTION_ID.remboursement_achat_adhérent_par_chèque;
          default:
            console.log('erreur de nature', nature);
            return null
        }

      case 'K':   // droits de table':

        switch (nature) {
          case 'espèces':
          case 'vente en espèces':
            return TRANSACTION_ID.vente_en_espèces;
          case 'chèque':
          case 'vente par chèque':
            return TRANSACTION_ID.vente_par_chèque;
          case 'remise espèces':
            return TRANSACTION_ID.dépôt_caisse_espèces;

          default:
            console.log('erreur de nature', nature);
            return null
        }

      // case 'R999': // les reports
      // case 'report chèque':
      //   return TRANSACTION_ID.report_chèque;
      // case 'report prélèvement':
      //   return TRANSACTION_ID.report_prélèvement;

      default:
        console.log('erreur de feuille', this.worksheet.name);
        return null;
    }
  }
  control_amounts_balance(row_nbr: number, book_entry: BookEntry): boolean {

    // check if the amounts are defined and not null

    if (book_entry.amounts === undefined || book_entry.amounts === null || book_entry.operations.length === 0) {
      console.log('book_entry amounts undefined', book_entry);
      this.verbose.set(this.verbose() + '[' + row_nbr + '] ' + 'montants non renseignés : ' + '\n');
      return false;
    }

    // calcul des montants encaissés ou décaissés
    let debit_keys: FINANCIAL_ACCOUNT[] = Object.keys(book_entry.amounts).filter((key): key is FINANCIAL_ACCOUNT => key.includes('_in'));
    let amount_total_debit = debit_keys.reduce((acc, key) => acc + (book_entry.amounts[key] || 0), 0);

    let credit_keys: FINANCIAL_ACCOUNT[] = Object.keys(book_entry.amounts).filter((key): key is FINANCIAL_ACCOUNT => key.includes('_out'));
    let amount_total_credit = credit_keys.reduce((acc, key) => acc + (book_entry.amounts[key] || 0), 0);


    // calcul des avoir et dettes exercés
    let debt_asset_debit_keys: string[] = Object.keys(EXTRA_CUSTOMER_IN);
    let total_debt_asset_debit = book_entry.operations.reduce((acc, operation) => {
      return acc + debt_asset_debit_keys.reduce((sum, key) => sum + (operation.values[key] || 0), 0);
    }, 0);

    let debt_asset_credit_keys: string[] = Object.keys(EXTRA_CUSTOMER_OUT);
    let total_debt_asset_credit = book_entry.operations.reduce((acc, operation) => {
      return acc + debt_asset_credit_keys.reduce((sum, key) => sum + (operation.values[key] || 0), 0);
    }, 0);

    // calcul des produits et dépenses
    let total_sale_credit = 0;
    let total_sale_debit = 0;


    switch (this.transactionService.transaction_class(book_entry.transaction_id)) {
      case TRANSACTION_CLASS.REVENUE_FROM_MEMBER:
      case TRANSACTION_CLASS.OTHER_REVENUE:
      case TRANSACTION_CLASS.REIMBURSEMENT:
        let product_keys = Object.keys(PRODUCTS_COL);
        total_sale_credit = book_entry.operations.reduce((acc, operation) => {
          return acc + product_keys.reduce((sum, key) => sum + (operation.values[key] || 0), 0);
        }, 0);
        break;
      case TRANSACTION_CLASS.EXPENSE_FOR_MEMBER:
      case TRANSACTION_CLASS.OTHER_EXPENSE:
        let expense_keys = Object.keys(EXPENSES_COL);
        total_sale_debit = book_entry.operations.reduce((acc, operation) => {
          return acc + expense_keys.reduce((sum, key) => sum + (operation.values[key] || 0), 0);
        }, 0);
        break
      case TRANSACTION_CLASS.MOVEMENT:
      case TRANSACTION_CLASS.BALANCE:
        break;
      default:
        console.log('erreur de classe', this.transactionService.transaction_class(book_entry.transaction_id));
        this.verbose.set(this.verbose() + '[' + row_nbr + '] ' + 'erreur de classe : ' + this.transactionService.transaction_class(book_entry.transaction_id) + '\n');
        return false;
    }

    let check_sum = amount_total_debit + total_debt_asset_debit + total_sale_debit - amount_total_credit - total_debt_asset_credit - total_sale_credit;



    if (check_sum !== 0) {
      console.log('amounts not equal \n debit : %s,%s,%s \n crédits : %s,%s,%s',
        amount_total_debit, total_debt_asset_debit, total_sale_debit,
        amount_total_credit, total_debt_asset_credit, total_sale_credit);

      console.log('book_entry', book_entry);
      this.verbose.set(this.verbose() + '[' + row_nbr + '] =>' + book_entry.date + '(' + book_entry.operations[0].member + ')' + ' montants non égaux \n');
      return false;
    }
    // console.log('amounts are equal', amount_total_debit, amount_total_credit, products_sum, expenses_sum);

    return true;
  }

  cell_value(cell: ExcelJS.Cell): string {
    if (cell.value === null || cell.value === undefined) {
      return '';
    } else if (typeof cell.value === 'string') {
      return cell.value;
    } else if (typeof cell.value === 'number') {
      return cell.value.toString();
    } else if (typeof cell.value === 'object' && cell.result) {
      return cell.result.toString() as string;
    } else {
      return JSON.stringify(cell.value);
    }
  }

  compute_operation_values(transaction: Transaction, row: ExcelJS.Row): Operation {


    let label = this.cell_value(row.getCell(MAP.intitulé));

    let operation: Operation = {
      label: label,
      values: {}
    };


    switch (transaction.class) {
      case TRANSACTION_CLASS.REVENUE_FROM_MEMBER:
      case TRANSACTION_CLASS.OTHER_REVENUE:
      case TRANSACTION_CLASS.REIMBURSEMENT:
        operation.values = this.get_revenues_values(row);
        break;
      case TRANSACTION_CLASS.EXPENSE_FOR_MEMBER:
      case TRANSACTION_CLASS.OTHER_EXPENSE:
      case TRANSACTION_CLASS.BALANCE:
        operation.values = this.get_expenses_values(row);
        break;
      case TRANSACTION_CLASS.MOVEMENT:
        operation.values = {};
        break;
    }

    if (transaction.nominative) {
      let cell_member = row.getCell(MAP.intitulé).value?.toString() || '';
      let member = this.retrieve_member(row.number, cell_member);
      if (member === null) {
        console.log('%s member not found at row %s ', cell_member, row.number);
        return operation;
      } else {
        operation.member = member.lastname + ' ' + member.firstname;
        operation.label = 'vente adhérent';
      }
    }

    return operation;

  }

  get_revenues_values(row: ExcelJS.Row): operation_values {

    let values: operation_values = {};
    Object.entries(PRODUCTS_COL)
      .concat(Object.entries(EXTRA_CUSTOMER_IN))
      .concat(Object.entries(EXTRA_CUSTOMER_OUT))
      .forEach(element => {
        let [account, col] = element;
        let cellValue = row.getCell(col).value;
        if (cellValue !== null && cellValue !== undefined) {
          let price = cellValue.valueOf() as number;
          values[account] = price;
        }
      });
    return values;
  }

  get_expenses_values(row: ExcelJS.Row): operation_values {
    let values: operation_values = {};
    Object.entries(EXPENSES_COL)
      .concat(Object.entries(EXTRA_CUSTOMER_IN))
      .concat(Object.entries(EXTRA_CUSTOMER_OUT))
      .forEach((expense) => {
        let [account, col] = expense;
        let cellValue = row.getCell(col).value;
        if (cellValue !== null && cellValue !== undefined) {
          let price = cellValue.valueOf() as number;
          values[account] = price;
        }
      });

    return values;
  }


  retrieve_member(row_nbr: number, name: string): Member | null {
    if (name === null || name === undefined || name === '') {
      // this.verbose.set(this.verbose() + '[' + row_nbr + '] ' + 'nom non renseigné : ' + '\n');
      return null;
    }

    let concat = (name: string) => {
      return name.split('').filter(char => (char !== ' ' && char !== '-')).join('').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    };

    const member = this.members.find((member) => (concat(member.lastname + member.firstname)) === concat(name));

    if (member) {
      return member
    } else {
      this.verbose.set(this.verbose() + '[' + row_nbr + '] ' + name + ' n\'est pas un(e) adhérent(e) connu(e) : ' + '\n');
      return null;
    }
  }

  clear_db() {
    this.verbose.set(this.verbose() + 'raz de la base de données ');
    this.bookService.book_entries_bulk_delete$(this.current_season).subscribe((nbr) => {
      this.verbose.set(this.verbose() + '...' + nbr + ' écritures supprimées \n');
    });
  }
}
