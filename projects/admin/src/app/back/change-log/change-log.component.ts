import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChangeLogDataService } from './change-log-data.service';
import {
  CHANGE_LOG_AREAS,
  CHANGE_LOG_KINDS,
  CHANGE_LOG_SITES,
  ChangeLogArea,
  ChangeLogEntry,
  ChangeLogKind,
  ChangeLogSite,
} from './change-log.model';

@Component({
  selector: 'app-change-log',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './change-log.component.html',
  styleUrl: './change-log.component.scss',
})
export class ChangeLogComponent {
  readonly entries: ChangeLogEntry[];
  readonly areas = CHANGE_LOG_AREAS;
  readonly kinds = CHANGE_LOG_KINDS;
  readonly sites = CHANGE_LOG_SITES;
  selectedSite: ChangeLogSite | '' = '';
  selectedArea: ChangeLogArea | '' = '';
  selectedKind: ChangeLogKind | '' = '';

  constructor(changeLogData: ChangeLogDataService) {
    this.entries = changeLogData.getPublishedEntries();
  }

  get filteredEntries(): ChangeLogEntry[] {
    return this.entries.filter((entry) =>
      (!this.selectedSite || entry.site === this.selectedSite)
      && (!this.selectedArea || entry.area === this.selectedArea)
      && (!this.selectedKind || entry.kind === this.selectedKind)
    );
  }

  resetFilters(): void {
    this.selectedSite = '';
    this.selectedArea = '';
    this.selectedKind = '';
  }

  areaLabel(entry: ChangeLogEntry): string {
    return CHANGE_LOG_AREAS.find((area) => area.value === entry.area)?.label ?? entry.area;
  }

  kindLabel(entry: ChangeLogEntry): string {
    return CHANGE_LOG_KINDS.find((kind) => kind.value === entry.kind)?.label ?? entry.kind;
  }

  kindClass(entry: ChangeLogEntry): string {
    return CHANGE_LOG_KINDS.find((kind) => kind.value === entry.kind)?.cssClass ?? 'text-bg-secondary';
  }

  siteLabel(entry: ChangeLogEntry): string {
    return CHANGE_LOG_SITES.find((site) => site.value === entry.site)?.label ?? entry.site;
  }
}
