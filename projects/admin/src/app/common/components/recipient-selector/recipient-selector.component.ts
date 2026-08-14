import { Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MembersService } from '../../services/members.service';
import { Member } from '../../interfaces/member.interface';

@Component({
  selector: 'app-recipient-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recipient-selector.component.html',
})
export class RecipientSelectorComponent implements OnInit {
  @Output() selectionChange = new EventEmitter<Member[]>();

  private membersService = inject(MembersService);

  readonly uniqueId = Math.random().toString(36).slice(2);
  members: Member[] = [];
  memberSelection = new Map<string, boolean>();
  filterText = '';
  showSelectedOnly = false;

  get filteredMembers(): Member[] {
    const q = this.filterText.toLowerCase();
    return this.members.filter((member) => {
      const matchesSelection = !this.showSelectedOnly || this.isSelected(member.id);
      const matchesText = !q || `${member.lastname} ${member.firstname} ${member.email}`.toLowerCase().includes(q);
      return matchesSelection && matchesText;
    });
  }

  get activeMailingCount(): number {
    return this.members.filter(m => m.accept_mailing && this.hasValidEmail(m)).length;
  }

  get selectedCount(): number {
    return this.members.filter(m => this.memberSelection.get(m.id)).length;
  }

  get allSelected(): boolean {
    return this.activeMailingCount > 0 && this.selectedCount === this.activeMailingCount;
  }

  get selectionIndeterminate(): boolean {
    return this.selectedCount > 0 && !this.allSelected;
  }

  ngOnInit() {
    this.membersService.listMembers().subscribe(members => {
      this.members = members.filter(m => this.hasValidEmail(m));
      this.emit();
    });
  }

  toggleMember(id: string) {
    this.memberSelection.set(id, !(this.memberSelection.get(id) ?? false));
    this.emit();
  }

  toggleAllMembers(checked: boolean) {
    if (checked) {
      this.members.filter(m => m.accept_mailing).forEach(m => this.memberSelection.set(m.id, true));
    } else {
      this.memberSelection.clear();
    }
    this.emit();
  }

  clearSelection() {
    this.memberSelection.clear();
    this.emit();
  }

  loadMemberNames(memberNames: string[]): string[] {
    const requestedNames = new Set(memberNames);
    const loadedNames = new Set<string>();

    this.memberSelection.clear();
    this.members.forEach((member) => {
      const fullName = this.membersService.full_name(member);
      if (requestedNames.has(fullName) && member.accept_mailing) {
        this.memberSelection.set(member.id, true);
        loadedNames.add(fullName);
      }
    });
    this.emit();

    return memberNames.filter((name) => !loadedNames.has(name));
  }

  isSelected(id: string): boolean {
    return this.memberSelection.get(id) ?? false;
  }

  resolve(): Member[] {
    return this.members.filter(m => m.accept_mailing && this.memberSelection.get(m.id));
  }

  private emit() {
    this.selectionChange.emit(this.resolve());
  }

  private hasValidEmail(m: Member): boolean {
    return !!m.email && m.email.includes('@') && !m.email.includes('?');
  }
}
