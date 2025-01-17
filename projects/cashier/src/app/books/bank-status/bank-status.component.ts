import { Component } from '@angular/core';
import { BankStatement, Expense, Bookentry, FINANCIAL_ACCOUNTS, Revenue } from '../../../../../common/accounting.interface';
import { BookService } from '../../book.service';
import { CommonModule } from '@angular/common';
import { Form, FormsModule } from '@angular/forms';

@Component({
  selector: 'app-bank-status',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bank-status.component.html',
  styleUrl: './bank-status.component.scss'
})
export class BankStatusComponent {

  // book_entries: Bookentry[] = [];
  bank_statements: BankStatement[] = [];
  bank_or_saving_ops = Object.values(FINANCIAL_ACCOUNTS).filter(op => op.includes('bank') || op.includes('saving'));

  constructor(
    private bookService: BookService,
  ) {
    this.bookService.list_book_entries$().subscribe((book_entries) => {
      // filtrer les operations de type banque ou éparge
      // extraire la partie bancaire des opérations
      let bank_statements: BankStatement[] = book_entries
        .filter(book_entry => this.bank_or_saving_ops.some(op => book_entry.amounts[op] !== undefined))
        .map(book_entry => { let { operations, ...bank_statement } = book_entry; return bank_statement; });

      // cumuler les montants de chèque de même bordereau de dépôt
      let bordereaux = bank_statements.map(statement => statement.deposit_ref);
      bordereaux = [...new Set(bordereaux)];
      bordereaux.map(bordereau => {
        let statements = bank_statements.filter(statement => statement.deposit_ref === bordereau);
        let amounts = statements.reduce((acc: { [key: string]: number }, statement) => {
          Object.entries(statement.amounts).forEach(([op, amount]) => {
            acc[op] = (acc[op] || 0) + amount;
          });
          return acc;
        }, {});
        this.bank_statements.push({ deposit_ref: bordereau, amounts, date: statements[0].date, season: statements[0].season, bank_op_type: statements[0].bank_op_type });
      });
    });
  }

  show_statement(statement: BankStatement) {
    console.log(statement);
  }
}
