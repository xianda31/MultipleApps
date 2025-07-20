import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, tap, switchMap, catchError, of, Observable } from 'rxjs';
import { Expense, Revenue } from '../../../../common/accounting.interface';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { BookService } from '../book.service';
import { TransactionService } from '../transaction.service';
import { MembersService } from '../../../../web-back/src/app/members/service/members.service';
import { Member } from '../../../../common/member.interface';
import { InputMemberComponent } from '../input-member/input-member.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../../common/toaster/toast.service';

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

  verbose = signal<string>('');
 missing_registration : boolean = false;

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
      }),
      switchMap((conf) => this.bookService.list_book_entries$(conf.season)),
      catchError((err) => {
        console.error('Error loading book entries:', err);
        this.loaded = true; // still loaded, but no entries
        return of([]);
      })
    ).subscribe(
      (entries) => {
        this.operations = this.bookService.get_operations();
        this.missing_registration = false;
        this.check_membership_payments();
        this.loaded = true;
      }
    );
  }



  check_membership_payments() {

    this.members.forEach((member) => {
      if (member.license_status === 'unpaied') {
        let full_name = this.memberService.full_name(member);
        const paied = this.operations
          .filter((op) => op.member === full_name)
          .some((op) => op.values['ADH'] );

        if (paied) {
          this.verbose.set(this.verbose() + `${member.firstname} ${member.lastname} \n`);
          this.missing_registration = true;
        }
      }
    });
  }


  member_selected() {
    if (this.selected_member) {
      let full_name = this.memberService.full_name(this.selected_member);
      this.revenues = this.operations.filter((op) => op.member === full_name)
    }
  }

  member_clear() {
    this.selected_member = null;
    this.revenues = [];
  }
}
