import { Component, signal } from '@angular/core';
import { EXPENSE, Expense, EXPENSES_ACCOUNTS, Financial, FINANCIALS, MOVEMENT, op_Value, Operation, PRODUCTS_ACCOUNTS, REVENUE, Revenue } from '../../../../common/new_sales.interface';
import { BookService } from '../book.service';
import { CommonModule } from '@angular/common';
import { SystemDataService } from '../../../../common/services/system-data.service';
import * as ExcelJS from 'exceljs';
import { EXPENSES_COL, FINANCIAL_COL, MAP, PRODUCTS_COL } from '../../../../common/excel/excel.interface';
import { Member } from '../../../../common/member.interface';
import { MembersService } from '../../../../admin-dashboard/src/app/members/service/members.service';
import { Product } from '../../../../admin-dashboard/src/app/sales/products/product.interface';
import { ProductService } from '../../../../common/services/product.service';
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-test',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './test.component.html',
  styleUrl: './test.component.scss'
})
export class TestComponent {
  products: Product[] = [];

  loaded = false;
  create_progress = 0;
  progress_style = 'width: 0%';
  // verbose: string = '';
  verbose = signal<string>('');
  excel_uploaded: boolean = false;
  data_uploading = false;
  members: Member[] = [];
  season: string = '2024/2025';

  workbook!: ExcelJS.Workbook;
  worksheet !: ExcelJS.Worksheet;
  worksheets!: ExcelJS.Worksheet[];


  //

  revenues!: Revenue[];
  expenses: Expense[] = [];

  financials: Financial[] = [];
  bank_financials: Financial[] = [];
  cash_financials: Financial[] = [];
  current_cash_amount: number = 0;

  products_accounts = Object.entries(PRODUCTS_COL).map(([account, col]) => account as PRODUCTS_ACCOUNTS);
  expenses_accounts = Object.entries(EXPENSES_COL).map(([account, col]) => account as EXPENSES_ACCOUNTS);


  financial_ops = Object.values(FINANCIALS);
  bank_ops = this.financial_ops.filter(op => !op.includes('cash') && !op.includes('avoir'));
  cash_ops = this.financial_ops.filter(op => op.includes('cash'));

  constructor(
    private bookService: BookService,
    private membersService: MembersService,
    private productsService: ProductService,


  ) {
    console.log('test component');
    this.init_test_entries();
  }

  async ngOnInit() {
    this.membersService.listMembers().subscribe((members) => {
      this.members = members;
    });

    this.productsService.listProducts().subscribe((products) => {
      this.products = products;
    });


    this.bookService.list_financials$().subscribe((financials) => {
      this.financials = financials;
      this.build_arrays();

      this.current_cash_amount = this.cash_financials.reduce((acc, financial) => {
        return acc + (financial.amounts['cash_in'] || 0) - (financial.amounts['cash_out'] || 0);
      }, 0);
    });


  }

  build_arrays() {
    this.bank_financials = this.financials.filter(financial => this.bank_ops.some(op => financial.amounts[op] !== undefined));
    this.cash_financials = this.financials.filter(financial => this.cash_ops.some(op => financial.amounts[op] !== undefined));

    this.revenues = this.bookService.get_revenues_from_members();

    this.expenses = this.financials.reduce((acc, financial) => {
      const expenses = financial.operations
        .filter(op => op.operation_type === EXPENSE.ANY)
        .map(op => ({
          ...op,
          season: financial.season,
          date: financial.date
        } as Expense));
      return [...acc, ...expenses];
    }, [] as Expense[]);

    // console.log('financial', this.financials);
  }


  data_store() { }

  onFileChange(event: any) {
    this.loaded = false;
    this.excel_uploaded = false;
    const file = event.target.files[0];
    // console.log('file', file);
    let workbook = new ExcelJS.Workbook();

    workbook.xlsx.load(file).then((workbook) => {
      this.verbose.set('\n');
      this.workbook = workbook;
      this.worksheets = workbook.worksheets;

    });
  }

  select_sheet() {
    this.process_exel_file(this.worksheet);
    this.loaded = true;
    this.excel_uploaded = true;

  }

  // test_sheet(worksheet: ExcelJS.Worksheet) {
  //   this.process_exel_file(worksheet);
  // }

  process_exel_file(worksheet: ExcelJS.Worksheet) {
    this.worksheet = worksheet;
    console.log('processing worksheet ', this.worksheet.name);

    // recherche balise ?999

    let cell_999 = this.worksheet.getColumn(MAP.chrono).values.find((cell) => cell && cell.toString().endsWith('999'));
    console.log('cell_999', cell_999);
    if (!cell_999) {
      console.log('balise 999 non trouvée');
      return;
    }


    let meta_rows: { [master: string]: string[] } = {};
    let col_nature = this.worksheet.getColumn(MAP.nature);

    // recherche des cellules mergées (colonne Nature) => meta_rows

    col_nature.eachCell((cell, rowNumber) => {
      let cell_chrono = this.worksheet.getCell(MAP.chrono + rowNumber).toString();

      if (cell_chrono.startsWith(cell_999!.toString().substring(0, 1)) && cell_chrono !== cell_999!.toString()) {

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
    });

    // traitement lignes du tableau meta_rows (bloc de cellules mergées)

    Object.entries(meta_rows).forEach(([master, cells]) => {
      this.process(master, cells).then((financial) => {
        // this.financials.push(financial);
        // console.log('financials ! ', this.financials.length);
        this.build_arrays();
      })
        .catch((error) => {
          console.log('error at row %s', master, error);
        }
        );
    });
  }

  async process(master: string, cells: string[]): Promise<Financial> {

    let promise = new Promise<Financial>((resolve, reject) => {
      // create sale (master)
      let row_number = +this.worksheet.getCell(master).row;

      // console.log('processing row %s', row_number);
      let master_row = this.worksheet.getRow(row_number);
      let date = master_row.getCell(MAP.date).value?.toString() || '';

      let cell_chrono = master_row.getCell(MAP.chrono).value?.toString() || '';
      if (cell_chrono.startsWith('C')) {
        let cell_member = master_row.getCell(MAP.intitulé).value?.toString() || '';
        if (cell_member !== '') {
          let member = this.retrieve_member(master_row.number, cell_member);
          if (member === null) {
            console.log('member not found', row_number);
            reject('member not found');
            return
          } else {
            // console.log('bénéficiaire', member.lastname + ' ' + member.firstname);
          }
        }
      }

      // let cell_nature = master_row.getCell(MAP['nature']).value;

      let cell_chèque = master_row.getCell(MAP['n° chèque']).value;
      let cell_bordereau = master_row.getCell(MAP['bordereau']).value;

      let financial: Financial = {
        season: this.season,
        date: new Date(date).toISOString().split('T')[0],
        amounts: {},
        operations: [],
        bank_label: cell_bordereau?.toString() ?? '',
      };

      if (cell_chèque?.toString()) { financial.cheque_ref = cell_chèque?.toString() as string; }
      if (cell_bordereau?.toString()) { financial.deposit_ref = cell_bordereau?.toString() as string; }

      // financial.amounts

      Object.entries(FINANCIAL_COL).forEach((entry) => {
        let [name, col] = entry;
        let cell = master_row.getCell(col).value;
        if (!cell?.valueOf()) { return; }
        financial.amounts[name as FINANCIALS] = cell.valueOf() as number;
      });

      // construct products operation side

      cells.forEach((cell) => {
        let row_number = +this.worksheet.getCell(cell).row;
        let row = this.worksheet.getRow(row_number);
        let operation = this.compute_operation_amounts(row);
        financial.operations.push(operation);
      }
      );

      if (!this.control_amounts_balance(financial)) {
        reject('amounts not balanced');
        return;
      }


      this.bookService.create_financial(financial).then((financial) => {
        // console.log('row %s financial :', row_number, cell_bordereau?.toString());
        resolve(financial);
      }).catch((error) => {
        console.log('error', error);
        reject(error);
      });
    });
    return promise;
  }

  control_amounts_balance(financial: Financial): boolean {
    let debit_keys: FINANCIALS[] = Object.keys(financial.amounts).filter((key): key is FINANCIALS => key.includes('in'));
    let total_debit = debit_keys.reduce((acc, key) => acc + (financial.amounts[key] || 0), 0);

    let credit_keys: FINANCIALS[] = Object.keys(financial.amounts).filter((key): key is FINANCIALS => key.includes('out'));
    let total_credit = credit_keys.reduce((acc, key) => acc + (financial.amounts[key] || 0), 0);

    let total = total_debit - total_credit;

    let products_sum = 0;
    let expenses_sum = 0;
    financial.operations.forEach((operation) => {
      let sum = Object.values(operation.amounts).reduce((acc, amount) => acc + amount, 0);
      if (operation.operation_type === REVENUE.MEMBER || operation.operation_type === REVENUE.ANY) {
        products_sum += sum;
      } else if (operation.operation_type === EXPENSE.ANY) {
        expenses_sum += sum;
      }
    });

    if (total !== (products_sum - expenses_sum)) {
      console.log('amounts not equal', total_debit, total_credit, products_sum, expenses_sum);
      console.log('financial', financial);
      this.verbose.set(this.verbose() + 'montants non égaux : ' + total_debit + ' vs ' + total_credit + '\n');
      return false;
    }
    // console.log('amounts are equal', total_debit, total_credit, products_sum, expenses_sum);

    return true;
  }

  compute_operation_amounts(row: ExcelJS.Row): Operation {
    let operation!: Operation;
    let revenues = this.get_revenues_amounts(row);
    let cell_chrono = row.getCell(MAP.chrono).value?.toString() || '';
    if (Object.keys(revenues).length > 0) {
      operation = {
        label: row.getCell(MAP.intitulé).value?.toString() as string,
        operation_type: cell_chrono.startsWith('C') ? REVENUE.MEMBER : REVENUE.ANY,
        amounts: revenues,
        // beneficiary: row.getCell(MAP.membre).value?.toString() as string,
      };
    } else {
      let expenses = this.get_expenses_amounts(row);
      if (Object.keys(expenses).length > 0) {
        operation = {
          label: row.getCell(MAP.intitulé).value?.toString() as string,
          operation_type: EXPENSE.ANY,
          amounts: expenses,
        };
      } else {
        operation = {
          label: row.getCell(MAP.intitulé).value?.toString() as string,
          operation_type: MOVEMENT.ANY,
          amounts: {},
        };
      }
    }
    return operation;

  }

  get_revenues_amounts(row: ExcelJS.Row): op_Value {

    let amounts: op_Value = {};
    Object.entries(PRODUCTS_COL).forEach(element => {
      let [account, col] = element;
      let cellValue = row.getCell(col).value;
      if (cellValue !== null && cellValue !== undefined) {
        let price = cellValue.valueOf() as number;
        amounts[account as PRODUCTS_ACCOUNTS] = price;
      }
    });
    return amounts;
  }

  get_expenses_amounts(row: ExcelJS.Row): op_Value {
    let amounts: op_Value = {};
    Object.entries(EXPENSES_COL).forEach((expense) => {
      let [account, col] = expense;
      let cellValue = row.getCell(col).value;
      if (cellValue !== null && cellValue !== undefined) {
        let price = cellValue.valueOf() as number;
        amounts[account as EXPENSES_ACCOUNTS] = price;
      }
    });

    return amounts;
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

  //

  delete_financial(financial: Financial) {
    this.bookService.delete_financial(financial.id!).then((financial) => {
    });
  }



  //  patterns statiques pour tests

  test_patterns = [
    '----------',
    'Mrs Jane pays cash 30 for CAR and 53 for LIC',
    'City subvention by transfer on bank account',
    'John and Smith pay by check',
    'deposit cash to bank',
    'pay for students meeting',
    'fees of tournament xxx',
    '3000€ sur compte \épargne',
  ];

  financialA!: Financial;
  financialB!: Financial;
  financialC!: Financial;
  financialD!: Financial;

  financialXA!: Financial;
  financialDdT!: Financial;
  financialEP!: Financial;

  init_test_entries() {

    this.financialA = {
      season: '2021-2022',
      date: '2021-10-01',
      amounts: { 'cash_in': 83 },
      bank_label: 'BANK_LABEL.none',
      operations: [{
        operation_type: REVENUE.MEMBER,
        amounts: { "CAR": 30, "LIC": 53 },
        label: 'Ms. Jane',
        // beneficiary: 'Ms. Jane',
      }]
    };


    this.financialB = {
      season: '2021-2022',
      date: '2021-10-01',
      amounts: { 'bank_in': 300 },
      bank_label: 'BANK_LABEL.transfer_receipt',
      operations: [{
        operation_type: REVENUE.ANY,
        amounts: { "DIV": 299 },
        label: 'subvention Saint Orens',
      }]
    };

    this.financialC = {
      season: '2021-2022',
      date: '2021-10-01',
      amounts: { 'cash_out': 85, 'bank_in': 85 },
      bank_label: 'BANK_LABEL.cash_deposit',
      operations: [{
        operation_type: MOVEMENT.ANY,
        label: '',
        amounts: {}
      }],
      bank_report: 'NOV-24',
    };

    this.financialD = {
      season: '2021-2022',
      date: '2021-10-01',
      amounts: { 'bank_in': 136 },
      bank_label: 'BANK_LABEL.cheque_deposit',
      cheque_ref: 'BNP000123',
      deposit_ref: 'ref 0293456',
      bank_report: 'OCT-24',
      operations: [{
        operation_type: REVENUE.MEMBER,
        label: 'John Doe',
        amounts: { "LIC": 53 },
      },
      {
        operation_type: REVENUE.MEMBER,
        amounts: { "LIC": 53, "CAR": 30 },
        label: 'Mr. Smith',
      }]
    };

    this.financialEP = {
      season: '2021-2022',
      date: '2021-10-01',
      amounts: { 'saving_in': 3000, 'bank_out': 3000 },
      bank_label: 'BANK_LABEL.saving_deposit',
      operations: [{
        operation_type: MOVEMENT.ANY,
        label: '',
        amounts: {},
      }]
    };

    this.financialXA = {
      season: '2021-2022',
      date: '2021-10-01',
      amounts: { 'bank_out': 453.55 },
      bank_label: 'BANK_LABEL.cheque_emit',
      cheque_ref: 'CA000124',
      deposit_ref: '',
      bank_report: '',
      operations: [
        {
          operation_type: EXPENSE.ANY,
          label: 'Pot élèves',
          amounts: { "REU": 403.07, "MAT": 50.43 },
        }]
    };

    this.financialDdT = {
      season: '2021-2022',
      date: '2021-10-01',
      amounts: { 'cash_in': 26 },
      bank_label: 'BANK_LABEL.none',
      operations: [{
        operation_type: REVENUE.ANY,
        label: 'Tournoi xxx',
        amounts: { "DdT": 26 },
      }]
    };
  }

  select_test_pattern(event: any) {
    let test = event.target.value;
    let create_financial = (financial: Financial): Promise<Financial> => {

      if (this.control_amounts_balance(financial)) {
        return this.bookService.create_financial(financial);
      } else {
        return new Promise((resolve, reject) => {
          reject('amounts not balanced');
        });
      }
    }
    switch (test) {

      case '3000€ sur compte \épargne':
        create_financial(this.financialEP);
        break;

      case 'Mrs Jane pays cash 30 for CAR and 53 for LIC':
        create_financial(this.financialA).then((financial) => {
        });
        break;
      case 'City subvention by transfer on bank account':
        create_financial(this.financialB).then((financial) => {
        });
        break;
      case 'John and Smith pay by check':
        create_financial(this.financialD).then((financial) => {
        });
        break;
      case 'deposit cash to bank':
        create_financial(this.financialC).then((financial) => {
        });
        break;
      case 'pay for students meeting':
        create_financial(this.financialXA).then((financial) => {
        });
        break;
      case 'fees of tournament xxx':
        create_financial(this.financialDdT).then((financial) => {
        });
        break;
    }
  }
}



