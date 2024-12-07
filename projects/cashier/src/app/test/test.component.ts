import { Component } from '@angular/core';
import { BANK_LABEL, Expense, Financial, FINANCIAL_OPERATION, OPERATION_TYPE, Revenue } from '../../../../common/new_sales.interface';
import { BookService } from '../book.service';
import { CommonModule } from '@angular/common';
import { SystemDataService } from '../../../../common/services/system-data.service';

@Component({
  selector: 'app-test',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './test.component.html',
  styleUrl: './test.component.scss'
})
export class TestComponent {

  revenues!: Revenue[];

  financials: Financial[] = [];
  bank_financials: Financial[] = [];
  cash_financials: Financial[] = [];
  current_cash_amount: number = 0;

  p_accounts: string[] = [];
  x_accounts: string[] = [];

  expenses: Expense[] = [];


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

  financial_ops = Object.values(FINANCIAL_OPERATION);
  bank_ops = this.financial_ops.filter(op => !op.includes('cash'));
  cash_ops = this.financial_ops.filter(op => op.includes('cash'));
  constructor(
    private bookService: BookService,
    private SystemDataService: SystemDataService
  ) {
    this.init_test_entries();
  }

  async ngOnInit() {

    this.SystemDataService.configuration$.subscribe((conf) => {
      this.p_accounts = conf.product_accounts.map(account => account.key);
      this.x_accounts = conf.charge_accounts.map(account => account.key);
    });

    this.bookService.list_financials$().subscribe((financials) => {
      this.financials = financials;
      this.bank_financials = this.financials.filter(financial => this.bank_ops.some(op => financial.amounts[op] !== undefined));
      this.cash_financials = this.financials.filter(financial => this.cash_ops.some(op => financial.amounts[op] !== undefined));

      this.revenues = this.financials.reduce((acc, financial) => {
        const revenues = financial.operation
          .filter(op => op.operation_type === OPERATION_TYPE.REVENUE)
          .map(op => ({
            ...op,
            season: financial.season,
            date: financial.date
          } as Revenue));
        return [...acc, ...revenues];
      }, [] as Revenue[]);

      this.expenses = this.financials.reduce((acc, financial) => {
        const expenses = financial.operation
          .filter(op => op.operation_type === OPERATION_TYPE.EXPENSE)
          .map(op => ({
            ...op,
            season: financial.season,
            date: financial.date
          } as Expense));
        return [...acc, ...expenses];
      }, [] as Expense[]);

      this.current_cash_amount = this.cash_financials.reduce((acc, financial) => {
        return acc + (financial.amounts['cash_in'] || 0) - (financial.amounts['cash_out'] || 0);
      }, 0);
    });


  }

  delete_financial(financial: Financial) {
    this.bookService.delete_financial(financial.id!).then((financial) => {
    });
  }


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
      amounts: { 'cash_in': 85 },
      bank_label: BANK_LABEL.none,
      operation: [{
        operation_type: OPERATION_TYPE.REVENUE,
        amounts: { "CAR": 30, "LIC": 53 },
        label: 'vente du jour',
        beneficiary: 'Ms. Jane',
      }]
    };


    this.financialB = {
      season: '2021-2022',
      date: '2021-10-01',
      amounts: { 'bank_in': 300 },
      bank_label: BANK_LABEL.transfer_receipt,
      operation: [{
        operation_type: OPERATION_TYPE.REVENUE,
        amounts: { "DIV": 300 },
        label: 'subvention Saint Orens',
      }]
    };

    this.financialC = {
      season: '2021-2022',
      date: '2021-10-01',
      amounts: { 'cash_out': 85, 'bank_in': 85 },
      bank_label: BANK_LABEL.cash_deposit,
      operation: [{
        operation_type: OPERATION_TYPE.MOVEMENT,
        label: '',
        amounts: {}
      }],
      bank_report: 'NOV-24',
    };

    this.financialD = {
      season: '2021-2022',
      date: '2021-10-01',
      amounts: { 'bank_in': 136 },
      bank_label: BANK_LABEL.cheque_deposit,
      cheque_ref: 'BNP000123',
      deposit_ref: 'ref 0293456',
      bank_report: 'OCT-24',
      operation: [{
        operation_type: OPERATION_TYPE.REVENUE,
        label: 'vente du jour',
        amounts: { "LIC": 53 },
        beneficiary: 'John Doe',
      },
      {
        operation_type: OPERATION_TYPE.REVENUE,
        amounts: { "LIC": 53, "CAR": 30 },
        label: 'vente du jour',
        beneficiary: 'Mr. Smith',
      }]
    };

    this.financialEP = {
      season: '2021-2022',
      date: '2021-10-01',
      amounts: { 'saving_in': 3000, 'bank_out': 3000 },
      bank_label: BANK_LABEL.saving_deposit,
      operation: [{
        operation_type: OPERATION_TYPE.MOVEMENT,
        label: '',
        amounts: {},
      }]
    };

    this.financialXA = {
      season: '2021-2022',
      date: '2021-10-01',
      amounts: { 'bank_out': 453.50 },
      bank_label: BANK_LABEL.cheque_emit,
      cheque_ref: 'CA000124',
      deposit_ref: '',
      bank_report: '',
      operation: [
        {
          operation_type: OPERATION_TYPE.EXPENSE,
          label: 'Pot élèves',
          amounts: { "REU": 403.07, "MAT": 50.43 },
        }]
    };

    this.financialDdT = {
      season: '2021-2022',
      date: '2021-10-01',
      amounts: { 'cash_in': 26 },
      bank_label: BANK_LABEL.none,
      operation: [{
        operation_type: OPERATION_TYPE.REVENUE,
        label: 'Tournoi xxx',
        amounts: { "DdT": 26 },
      }]
    };
  }

  select_test_pattern(event: any) {
    let test = event.target.value;
    switch (test) {

      case '3000€ sur compte \épargne':
        this.bookService.create_financial(this.financialEP);
        break;

      case 'Mrs Jane pays cash 30 for CAR and 53 for LIC':
        this.bookService.create_financial(this.financialA).then((financial) => {
        });
        break;
      case 'City subvention by transfer on bank account':
        this.bookService.create_financial(this.financialB).then((financial) => {
        });
        break;
      case 'John and Smith pay by check':
        this.bookService.create_financial(this.financialD).then((financial) => {
        });
        break;
      case 'deposit cash to bank':
        this.bookService.create_financial(this.financialC).then((financial) => {
        });
        break;
      case 'pay for students meeting':
        this.bookService.create_financial(this.financialXA).then((financial) => {
        });
        break;
      case 'fees of tournament xxx':
        this.bookService.create_financial(this.financialDdT).then((financial) => {
        });
        break;
    }
  }
}



