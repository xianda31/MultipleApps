import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Group_names } from '../../common/authentification/group.interface';
import { BackPageShortcut, getBackPageShortcuts } from './back-page-shortcuts.definition';

@Component({
  selector: 'app-back-page-shortcuts',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './back-page-shortcuts.component.html',
  styleUrl: './back-page-shortcuts.component.scss',
})
export class BackPageShortcutsComponent {
  private selectedGroup: Group_names | null = null;
  shortcuts: BackPageShortcut[] = [];

  @Input({ required: true })
  set group(group: Group_names) {
    if (group === this.selectedGroup) {
      return;
    }

    this.selectedGroup = group;
    this.shortcuts = getBackPageShortcuts(group);
  }
}
