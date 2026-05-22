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
  recipientMode: 'all' | 'selected' = 'selected';
  members: Member[] = [];
  memberSelection = new Map<string, boolean>();
  filterText = '';

  get filteredMembers(): Member[] {
    if (!this.filterText.trim()) return this.members;
    const q = this.filterText.toLowerCase();
    return this.members.filter(m =>
      `${m.lastname} ${m.firstname} ${m.email}`.toLowerCase().includes(q)
    );
  }

  get activeMailingCount(): number {
    return this.members.filter(m => m.accept_mailing && this.hasValidEmail(m)).length;
  }

  get selectedCount(): number {
    return this.members.filter(m => this.memberSelection.get(m.id)).length;
  }

  ngOnInit() {
    this.membersService.listMembers().subscribe(members => {
      this.members = members.filter(m => this.hasValidEmail(m));
      this.emit();
    });
  }

  toggleMode(mode: 'all' | 'selected') {
    this.recipientMode = mode;
    this.emit();
  }

  toggleMember(id: string) {
    this.memberSelection.set(id, !(this.memberSelection.get(id) ?? false));
    this.emit();
  }

  selectAll() {
    this.members.filter(m => m.accept_mailing).forEach(m => this.memberSelection.set(m.id, true));
    this.emit();
  }

  clearSelection() {
    this.memberSelection.clear();
    this.emit();
  }

  isSelected(id: string): boolean {
    return this.memberSelection.get(id) ?? false;
  }

  /** Résolution finale : filtrée accept_mailing selon le mode */
  resolve(): Member[] {
    if (this.recipientMode === 'all') {
      return this.members.filter(m => m.accept_mailing);
    }
    return this.members.filter(m => this.memberSelection.get(m.id));
  }

  private emit() {
    this.selectionChange.emit(this.resolve());
  }

  private hasValidEmail(m: Member): boolean {
    return !!m.email && m.email.includes('@') && !m.email.includes('?');
  }
}
