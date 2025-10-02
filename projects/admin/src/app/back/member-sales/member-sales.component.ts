import { Component, signal } from '@angular/core';
import { tap, switchMap, catchError, of } from 'rxjs';
import { Expense, Formatted_purchase, Revenue } from '../../common/interfaces/accounting.interface';
import { SystemDataService } from '../../common/services/system-data.service';
import { BookService } from '../services/book.service';
import { LicenseStatus, Member } from '../../common/interfaces/member.interface';
import { InputMemberComponent } from '../input-member/input-member.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MembersService } from '../../common/services/members.service';
import { Revenue_and_expense_definition } from '../../common/interfaces/system-conf.interface';

interface Payment {  [key: string]:  number };

@Component({
  selector: 'app-member-sales',
  imports: [CommonModule, FormsModule, InputMemberComponent],
  templateUrl: './member-sales.component.html',
  styleUrl: './member-sales.component.scss'
})
export class MemberSalesComponent {
  loaded: boolean = false;
  season: string = '';
  operations: (Revenue | Expense)[] = [];
  revenues: Revenue[] = [];
  achats_ventes !: Formatted_purchase[];

  accounts: Revenue_and_expense_definition[] = [];
  selected_account: Revenue_and_expense_definition | null = null;
  payments: { [key: string]: Payment } = {};

  collectedLicenses: string[] = [];
  missingMembership: string[] = [];
  buyWithoutMembership: string[] = [];

  

  members: Member[] = [];
  selected_member: Member | null = null;
  truncature = '1.2-2';  // '1.0-0';// '1.2-2';  //
  constructor(
    private bookService: BookService,
    private systemDataService: SystemDataService,
    private memberService: MembersService,

  ) { }
  ngOnInit() {
    this.memberService.listMembers().pipe(
      tap((members) => {
        this.members = members;
        this.selected_member = null;
      }),
      switchMap(() => this.systemDataService.get_configuration()),
      tap((conf) => {
        this.season = conf.season;
        this.accounts = conf.revenue_and_expense_tree.revenues;
        
      }),
      switchMap((conf) => this.bookService.list_book_entries()),
      catchError((err) => {
        console.error('Error loading book entries:', err);
        this.loaded = true; // still loaded, but no entries
        return of([]);
      })
    ).subscribe(
      (entries) => {
  this.operations = this.bookService.get_revenues_from_members();
  this.check_license_declared();
  this.check_membership_paied();
  this.check_buy_without_membership();
  this.loaded = true;
      }
    );
  } 

check_buy_without_membership() {
  
    this.buyWithoutMembership = [];
    this.members.forEach((member) => {
        let full_name = this.memberService.full_name(member);
        const buy_op = this.operations
          .filter((op) => op.member === full_name);
          const hasAdh = buy_op.some(op => op.values['ADH']);
          const hasOther = buy_op.some(op => Object.keys(op.values).some(key => key !== 'ADH'));


        if (!hasAdh && hasOther) {
          this.buyWithoutMembership.push(full_name);
        }
    });
  }

  check_membership_paied() {
    this.missingMembership = [];
    this.members.forEach((member) => {
      if (member.license_status !== LicenseStatus.UNREGISTERED) {
        let full_name = this.memberService.full_name(member);
        const adh_paied = this.operations
          .filter((op) => op.member === full_name)
          .some((op) => op.values['ADH']);

        if (!adh_paied) {
          this.missingMembership.push(full_name);
        }
      }
    });
  }

  check_license_declared() {
    this.collectedLicenses = [];
    this.members.forEach((member) => {
      if (member.license_status !== LicenseStatus.DULY_REGISTERED) {
        let full_name = this.memberService.full_name(member);
        const lic_paied = this.operations
          .filter((op) => op.member === full_name)
          .some((op) => op.values['LIC']);

        if (lic_paied) {
          this.collectedLicenses.push(full_name);
        }
      }
    });
  }

  get_paiements(accountKey: string | null): { [key: string]: Payment } {
    if (!accountKey) {
      return {};
    }
    const paiements: { [key: string]: { [month: number]: number } } = {};
    this.members.forEach((member) => {
      let full_name = this.memberService.full_name(member);
      const ops = this.operations
        .filter((op) => op.member === full_name)
        .filter((op) => op.values[accountKey] != null);
      const monthMap: { [month: number]: number } = {};
      ops.forEach((op) => {
        const dateObj = new Date(op.date);
        const month = dateObj.getMonth() + 1;
        const amount = Number(op.values[accountKey]);
        monthMap[month] = (monthMap[month] || 0) + amount;
      });
      if (Object.keys(monthMap).length > 0) {
        paiements[full_name] = monthMap;
      }
    });
    return paiements;
  }

  member_selected() {
    if (this.selected_member) {
      let full_name = this.memberService.full_name(this.selected_member);
      this.achats_ventes = this.bookService.get_formated_buy_operations(full_name)
    }
  }

  member_clear() {
    this.selected_member = null;
    this.revenues = [];
  }

  onAccountKeyChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    select.blur();
    const account = this.selected_account;
    this.payments = this.get_paiements(this.selected_account?.key || null);
  }
}
