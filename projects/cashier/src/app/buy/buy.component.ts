import { CommonModule, formatDate } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { BackComponent } from '../../../../common/back/back.component';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MembersService } from '../../../../admin-dashboard/src/app/members/service/members.service';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { ToastService } from '../../../../common/toaster/toast.service';
import { BookService } from '../book.service';
import { TransactionService } from '../transaction.service';
import { Location } from '@angular/common';
import { BookEntry, TRANSACTION_ID } from '../../../../common/accounting.interface';
import { Transaction, TRANSACTION_CLASS } from '../../../../common/transaction.definition';
import { Account, Bank } from '../../../../common/system-conf.interface';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { BooksEditorComponent } from "../books/books-edit/books-editor.component";

@Component({
  selector: 'app-buy',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbTooltipModule,  BooksEditorComponent],
  templateUrl: './buy.component.html',
  styleUrl: './buy.component.scss'
})
export class BuyComponent implements OnInit {
  transaction_classes = [TRANSACTION_CLASS.EXPENSE_FOR_MEMBER, TRANSACTION_CLASS.OTHER_EXPENSE, TRANSACTION_CLASS.OTHER_REVENUE];
  transaction_ids !: TRANSACTION_ID[];
  NumberRegexPattern: string = '([-,+]?[0-9]+([.,][0-9]*)?|[.][0-9]+)';

  buyForm!: FormGroup;
  banks: Bank[] = [];
  club_bank!: Bank;
  expenses_accounts !: Account[];
  products_accounts !: Account[];
  expense_or_revenue_accounts: Account[] = [];
  form_ready = false;
  season!: string;
  creation = false;
  financial_accounts_locked = true;
  deposit_ref_changed = false;
  selected_book_entry!: BookEntry;

  selected_transaction: Transaction | undefined = undefined;
  constructor(
    private fb: FormBuilder,
    private transactionService: TransactionService,
    private systemDataService: SystemDataService,
    private location: Location

  ) { }
  ngOnInit(): void {
    this.systemDataService.get_configuration().subscribe((conf) => {
      this.season = conf.season;
      this.banks = conf.banks;

      this.club_bank = this.banks.find(bank => bank.key === conf.club_bank_key)!;
      this.expenses_accounts = conf.revenue_and_expense_tree.expenses;
    });

    this.init_form();
    this.valueChanges_subscribe();
  }

  init_form() {
    const today = formatDate(new Date(), 'yyyy-MM-dd', 'en');
    this.selected_transaction = undefined;
    this.buyForm = this.fb.group({
      'date': [today, Validators.required],
      'transac_class': ['', Validators.required],
      'transaction_id': ['', Validators.required],
      'amounts': new FormArray([]),
      'tag': [''],
      'cheque_number': [''],
      'operations': new FormArray([]),
    });
  }


 valueChanges_subscribe() {
    // form.transaction_class change handler
    this.buyForm.controls['transac_class'].valueChanges.subscribe((op_class) => {
      this.selected_transaction = undefined;
      this.transaction_ids = this.transactionService.class_to_ids(op_class);
    });

    // form.transaction_id change handler
    this.buyForm.controls['transaction_id'].valueChanges.subscribe((transaction_id) => {
      this.selected_transaction = this.transactionService.get_transaction(transaction_id);
      this.expense_or_revenue_accounts = this.select_expense_or_revenue_accounts(this.selected_transaction!);

      // initialisation form operations si en mode création

        this.operations.clear();
        this.add_operation(this.selected_transaction);

        this.amounts.clear();
    });


  }

   add_operation(transaction: Transaction) {
  
      let operationForm: FormGroup = this.fb.group({
        'label':  [''],
        'total': [{ value: '', disabled: true }]
      });
  
  
      if (transaction.nominative) {
        operationForm.addControl('member', new FormControl( '', Validators.required));
      }
  
      if (this.expense_or_revenue_accounts.length !== 0) {
        operationForm.addControl('values', this.fb.array(
          this.expense_or_revenue_accounts.map(() => new FormControl<string>((''), [Validators.pattern(this.NumberRegexPattern)])),
          { validators: [this.atLeastOneFieldValidator] }));
      }
  
      this.operations.push(operationForm);
  
    }
  
  // getters


  get transaction_id(): TRANSACTION_ID {
    return this.buyForm.get('transaction_id')?.value;
  }
  get operations(): FormArray {
    return this.buyForm.get('operations') as FormArray;
  }
  get amounts(): FormArray {
    return this.buyForm.get('amounts') as FormArray;
  }
  get date(): FormControl {
    return this.buyForm.get('date') as FormControl;
  }


  // utility methods
  transaction_label(transaction_id: TRANSACTION_ID): string {
    return this.transactionService.get_transaction(transaction_id).label;
  }
    transaction_tooltip(transaction_id: TRANSACTION_ID): string {
    return this.transactionService.get_transaction(transaction_id).tooltip;
  }

  select_expense_or_revenue_accounts(transaction: Transaction): Account[] {
    if (transaction === undefined) { throw new Error('transaction is undefined'); };
    if (transaction.pure_financial) return [];
    return transaction.revenue_account_to_show ? this.products_accounts : this.expenses_accounts;
  }
  
 atLeastOneFieldValidator(control: AbstractControl): ValidationErrors | null {
    const valid = control.value.some((value: string) => value !== '');
    return valid ? null : { atLeastOneFieldRequired: true };
  }


  date_in_season(date: string): boolean {
    return this.systemDataService.date_in_season(date, this.season);
  }
  cancel() {
    this.location.back();
  }
}
