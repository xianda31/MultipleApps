import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MembersService } from '../../services/members.service';
import { Member } from '../../interfaces/member.interface';

export type RecipientPreset = 'ACTIVE' | 'OVERDUE' | 'ADHERENTS';

@Component({
  selector: 'app-recipient-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recipient-selector.component.html',
})
export class RecipientSelectorComponent implements OnInit {
  @Input() searchPlaceholder = 'Filtrer…';
  @Input() excludedEmails: string[] = [];
  @Output() selectionChange = new EventEmitter<Member[]>();
  @Output() membershipChange = new EventEmitter<Member[]>();

  private membersService = inject(MembersService);

  readonly uniqueId = Math.random().toString(36).slice(2);
  allMembers: Member[] = [];
  memberSelection = new Map<string, boolean>();
  filterText = '';
  showSelectedOnly = false;

  get members(): Member[] {
    return this.allMembers.filter((member) => this.membersService.isActive(member));
  }

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
    return this.members.length > 0 && this.selectedCount === this.members.length;
  }

  get selectionIndeterminate(): boolean {
    return this.selectedCount > 0 && !this.allSelected;
  }

  ngOnInit() {
    this.membersService.listMembers().subscribe(members => {
      this.allMembers = members;
      this.removeUnavailableSelections();
      this.emit();
    });
  }

  applyPreset(preset: RecipientPreset): void {
    this.memberSelection.clear();
    this.addPreset(preset);
  }

  addPreset(preset: RecipientPreset): number {
    const before = this.selectedCount;
    this.members
      .filter((member) => this.matchesPreset(member, preset))
      .filter((member) => !this.isExcluded(member))
      .forEach((member) => this.memberSelection.set(member.id, true));
    this.emit();
    return this.selectedCount - before;
  }

  toggleMember(id: string) {
    this.memberSelection.set(id, !(this.memberSelection.get(id) ?? false));
    this.emit();
  }

  toggleAllMembers(checked: boolean) {
    if (checked) {
      this.members
        .filter((member) => !this.isExcluded(member))
        .forEach(m => this.memberSelection.set(m.id, true));
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
    this.memberSelection.clear();
    return this.addMemberNames(memberNames).unavailableNames;
  }

  addMemberNames(memberNames: string[]): { addedCount: number; unavailableNames: string[] } {
    const requestedNames = new Set(memberNames);
    const loadedNames = new Set<string>();
    const before = this.selectedCount;

    this.members.forEach((member) => {
      const fullName = this.membersService.full_name(member);
      if (requestedNames.has(fullName) && !this.isExcluded(member)) {
        this.memberSelection.set(member.id, true);
        loadedNames.add(fullName);
      }
    });
    this.emit();

    return {
      addedCount: this.selectedCount - before,
      unavailableNames: memberNames.filter((name) => !loadedNames.has(name)),
    };
  }

  selectedMemberIds(): string[] {
    return this.selectedMembers().map((member) => member.id);
  }

  setSelectedMemberIds(memberIds: string[]): void {
    const requestedIds = new Set(memberIds);
    this.memberSelection.clear();
    this.members
      .filter((member) => requestedIds.has(member.id))
      .filter((member) => !this.isExcluded(member))
      .forEach((member) => this.memberSelection.set(member.id, true));
    this.emit();
  }

  removeEmails(emails: string[]): void {
    const excluded = new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean));
    this.members
      .filter((member) => excluded.has((member.email ?? '').trim().toLowerCase()))
      .forEach((member) => this.memberSelection.delete(member.id));
    this.emit();
  }

  isSelected(id: string): boolean {
    return this.memberSelection.get(id) ?? false;
  }

  resolve(): Member[] {
    return this.selectedMembers().filter(m => m.accept_mailing && this.hasValidEmail(m) && !this.isExcluded(m));
  }

  private emit() {
    this.membershipChange.emit(this.selectedMembers());
    this.selectionChange.emit(this.resolve());
  }

  private selectedMembers(): Member[] {
    return this.members.filter(m => this.memberSelection.get(m.id));
  }

  private removeUnavailableSelections(): void {
    const availableIds = new Set(this.members.map((member) => member.id));
    for (const id of this.memberSelection.keys()) {
      if (!availableIds.has(id)) {
        this.memberSelection.delete(id);
      }
    }
  }

  private matchesPreset(member: Member, preset: RecipientPreset): boolean {
    if (preset === 'OVERDUE') {
      return this.membersService.isMembershipRenewalOverdue(member);
    }
    if (preset === 'ADHERENTS') {
      return this.membersService.hasPaidMembership(member);
    }
    return true;
  }

  private hasValidEmail(m: Member): boolean {
    return !!m.email && m.email.includes('@') && !m.email.includes('?');
  }

  isExcluded(member: Member): boolean {
    const email = (member.email ?? '').trim().toLowerCase();
    return !!email && this.excludedEmails.some((excluded) => excluded.trim().toLowerCase() === email);
  }
}
