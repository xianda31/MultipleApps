import { Component } from '@angular/core';
import { MembersService } from '../../../../admin-dashboard/src/app/members/service/members.service';
import { Member } from '../../../../common/members/member.interface';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputMemberComponent } from '../input-member/input-member.component';

@Component({
  selector: 'app-test',
  standalone: true,
  imports: [CommonModule, FormsModule, InputMemberComponent],
  templateUrl: './test.component.html',
  styleUrl: './test.component.scss'
})
export class TestComponent {
  members!: Member[];

  member!: Member | null;

  constructor(
    private membersService: MembersService,

  ) { }

  ngOnInit(): void {
    this.membersService.listMembers().subscribe((members) => {
      this.members = members;

      this.member = this.members[0];
    });

  }
}
