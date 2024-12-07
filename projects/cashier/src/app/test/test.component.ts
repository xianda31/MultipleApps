import { Component } from '@angular/core';
import { Expense, Financial, FINANCIAL_OPERATION, OPERATION_LABEL, Revenue } from '../../../../common/new_sales.interface';
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
  // m_revenues!: Revenue[];
  // t_revenues!: Revenue[];
  // x_revenues!: Revenue[];

  revenueA!: Revenue;
  revenueB!: Revenue;
  revenueD1!: Revenue;
  revenueD2!: Revenue;
  revenueDdT!: Revenue;

  // c_financials: Financial[] = [];
  // b_financials: Financial[] = [];
  financials: Financial[] = [];
  bank_financials: Financial[] = [];
  cash_financials: Financial[] = [];
  current_cash_amount: number = 0;

  financialA!: Financial;
  financialB!: Financial;
  financialC!: Financial;
  financialD!: Financial;

  financialXA!: Financial;
  financialDdT!: Financial;

  p_accounts: string[] = [];
  x_accounts: string[] = [];

  expenses: Expense[] = [];

  expenseA!: Expense;

  test_patterns = [
    '----------',
    'Mrs Jane pays 30 for CAR and 53 for LIC',
    'City subvention by transfer on bank account',
    'John and Smith pay by check',
    'deposit cash to bank',
    'pay for students meeting',
    'fees of tournament xxx'
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

    this.bookService.list_revenues$().subscribe((revenues) => {
      this.revenues = revenues;
      // this.m_revenues = revenues.filter(revenue => revenue.sub_account === 'client');
      // this.t_revenues = revenues.filter(revenue => revenue.sub_account === 'droits_de_table');
      // this.x_revenues = revenues.filter(revenue => revenue.sub_account === 'autre');
    });

    this.bookService.list_financials$().subscribe((financials) => {
      this.financials = financials;
      this.bank_financials = this.financials.filter(financial => this.bank_ops.some(op => financial.amounts[op] !== undefined));
      this.cash_financials = this.financials.filter(financial => this.cash_ops.some(op => financial.amounts[op] !== undefined));
      this.current_cash_amount = this.cash_financials.reduce((acc, financial) => {
        return acc + (financial.amounts['cash_in'] || 0) - (financial.amounts['cash_out'] || 0);
      }, 0);
    });

    this.bookService.list_expenses$().subscribe((expenses) => {
      this.expenses = expenses;
    });
  }


  delete_revenue(revenue: Revenue) {
    this.bookService.delete_revenue(revenue.id!).then((revenue) => {
      console.log('deleted', revenue);
    });
  }

  delete_expense(expense: Expense) {
    this.bookService.delete_expense(expense.id!).then((expense) => {
      console.log('deleted', expense);
    });
  }

  delete_financial(financial: Financial) {
    this.bookService.read_financial(financial.id!).then((financial) => {
      let revenues: Revenue[] = financial.revenues;
      if (revenues) {
        revenues.forEach((revenue) => {
          this.bookService.delete_revenue(revenue.id!).then((revenue) => {
          });
        });
      }
      let expense: Expense = financial.expense;
      if (expense) {
        this.bookService.delete_expense(expense.id!).then((expense) => {
        });
      }

      this.bookService.delete_financial(financial.id!).then((financial) => {
      });
    });
  }

  init_test_entries() {

    this.financialA = {
      season: '2021-2022',
      date: '2021-10-01',
      amounts: { 'cash_in': 85 },
      type: OPERATION_LABEL.cash_in,
    };
    this.revenueA = {
      amounts: { "CAR": 30, "LIC": 53 },
      // sub_account: SOUS_COMPTES_PRODUITS.client,
      label: 'vente du jour',
      beneficiary: 'Ms. Jane',
      financial_id: 'null',
    };

    this.revenueB = {
      // sub_account: SOUS_COMPTES_PRODUITS.aob,
      amounts: { "DIV": 300 },
      label: 'subvention Saint Orens',
      financial_id: 'null',
    };
    this.financialB = {
      season: '2021-2022',
      date: '2021-10-01',
      amounts: { 'bank_in': 300 },
      type: OPERATION_LABEL.transfer_in,
    };

    this.financialC = {
      season: '2021-2022',
      date: '2021-10-01',
      c2b: 'Dépot espèces',
      amounts: { 'cash_out': 85, 'bank_in': 85 },
      type: OPERATION_LABEL.cash_in,
      bank_report: 'NOV-24',
    };


    this.financialD = {
      season: '2021-2022',
      date: '2021-10-01',
      amounts: { 'bank_in': 136 },
      type: OPERATION_LABEL.cheque_in,
      cheque_ref: 'BNP000123',
      deposit_ref: 'ref 0293456',
      bank_report: 'OCT-24',
    };

    this.revenueD1 = {
      // sub_account: SOUS_COMPTES_PRODUITS.client,
      amounts: { "LIC": 53 },
      label: 'vente du jour',
      beneficiary: 'John Doe',
      financial_id: 'null',
    };
    this.revenueD2 = {
      // sub_account: SOUS_COMPTES_PRODUITS.client,
      amounts: { "LIC": 53, "CAR": 30 },
      label: 'vente du jour',
      beneficiary: 'Mr. Smith',
      financial_id: 'null',
    };

    this.expenseA =
    {
      // sub_account: SOUS_COMPTES_CHARGES.other,
      label: 'Pot élèves',
      amounts: { "REU": 403.07, "MAT": 50.43 },
      financial_id: 'null',
    };

    this.financialXA = {
      season: '2021-2022',
      date: '2021-10-01',
      amounts: { 'bank_out': 453.50 },
      type: OPERATION_LABEL.cheque_out,
      cheque_ref: 'CA000124',
      deposit_ref: '',
      bank_report: '',
    };

    this.financialDdT = {
      season: '2021-2022',
      date: '2021-10-01',
      amounts: { 'cash_in': 26 },
      type: OPERATION_LABEL.cash_in,
    };
    this.revenueDdT = {
      // sub_account: SOUS_COMPTES_PRODUITS.tournament,
      amounts: { "DdT": 26 },
      label: 'Tournoi xxx',
      financial_id: 'null',
    };
  }




  select_test_pattern(event: any) {
    let test = event.target.value;
    switch (test) {
      case 'Mrs Jane pays 30 for CAR and 53 for LIC':
        this.bookService.create_financial(this.financialA).then((financial) => {
          let revenue = { ...this.revenueA, financial_id: financial.id };
          this.bookService.create_revenue(revenue).then((revenue) => {
          });
        });
        break;
      case 'City subvention by transfer on bank account':
        this.bookService.create_financial(this.financialB).then((financial) => {
          let revenue = { ...this.revenueB, financial_id: financial.id };
          this.bookService.create_revenue(revenue).then((revenue) => {
          });
        });
        break;
      case 'John and Smith pay by check':
        this.bookService.create_financial(this.financialD).then((financial) => {
          let revenue1 = { ...this.revenueD1, financial_id: financial.id };
          this.bookService.create_revenue(revenue1).then((revenue) => {
          });
          let revenue2 = { ...this.revenueD2, financial_id: financial.id };
          this.bookService.create_revenue(revenue2).then((revenue) => {
          });
        });
        break;
      case 'deposit cash to bank':
        this.bookService.create_financial(this.financialC).then((financial) => {
        });
        break;
      case 'pay for students meeting':
        this.bookService.create_financial(this.financialXA).then((financial) => {
          this.expenseA.financial_id = financial.id!;
          this.bookService.create_expense(this.expenseA).then((expense) => {
          });
        });
        break;
      case 'fees of tournament xxx':
        this.bookService.create_financial(this.financialDdT).then((financial) => {
          this.revenueDdT.financial_id = financial.id!;
          this.bookService.create_revenue(this.revenueDdT).then((revenue) => {
          });
        });
        break;
    }
  }
}



