
import { Component, OnInit } from '@angular/core';
import { AssistanceRequest, REQUEST_STATUS } from '../../common/interfaces/assistance-request.interface';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AssistanceRequestService } from '../../common/services/assistance-request.service';
import { SystemDataService } from '../../common/services/system-data.service';
import { take } from 'rxjs';

@Component({
    selector: 'app-back-assistance',
    standalone: true,
    imports: [CommonModule, FormsModule],
    providers: [DatePipe],
    templateUrl: './back-assistance.component.html',
    styleUrls: ['./back-assistance.component.scss']
})
export class BackAssistanceComponent implements OnInit {
    requests: AssistanceRequest[] = [];
    statusOptions = [
        { value: REQUEST_STATUS.NEW, label: '🔴 Nouveau' },
        { value: REQUEST_STATUS.IN_PROGRESS, label: '🟡 En cours' },
        { value: REQUEST_STATUS.RESOLVED, label: '🟢 Résolu' }
    ];

    statusFilter: string = '';
    sortOrder: 'asc' | 'desc' = 'desc';
    private resolvedRetentionDays = 90;

    get resolvedRetentionLabel(): string {
        return `Suppression automatique des tickets résolus après ${this.resolvedRetentionDays} jours`;
    }

    constructor(
        private assistanceService: AssistanceRequestService,
        private systemDataService: SystemDataService
    ) { }

    getStatusBadgeClass(status: string): string {
        if (status === REQUEST_STATUS.NEW) return 'bg-danger';
        if (status === REQUEST_STATUS.RESOLVED) return 'bg-success';
        return '';
    }

    getStatusBadgeStyle(status: string): { [key: string]: string } {
        if (status === REQUEST_STATUS.IN_PROGRESS) {
            return { backgroundColor: '#90EE90', color: '#000' };
        }
        return {};
    }

    getStatusLabel(status: string): string {
        const found = this.statusOptions.find(s => s.value === status);
        return found ? found.label : status;
    }

    ngOnInit() {
        this.systemDataService.get_configuration().pipe(take(1)).subscribe((conf) => {
            this.resolvedRetentionDays = conf.assistance_request_retention_days ?? 90;
        });
        this.assistanceService.getAllRequests().subscribe(requests => {
            this.requests = requests;
        });
    }
    get filteredRequests(): AssistanceRequest[] {
        let filtered = this.requests;
        if (this.statusFilter) {
            filtered = filtered.filter(r => r.status === this.statusFilter);
        }
        // Tri par date de création
        return filtered.sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return this.sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });
    }

    toggleSortOrder() {
        this.sortOrder = this.sortOrder === 'desc' ? 'asc' : 'desc';
    }

    updateStatus(request: AssistanceRequest, newStatus: string) {
        const ttl = newStatus === REQUEST_STATUS.RESOLVED
            ? Math.floor(Date.now() / 1000) + this.resolvedRetentionDays * 24 * 3600
            : undefined;
        const updated = { ...request, status: newStatus, ttl };
        this.assistanceService.updateRequest(updated);
    }

    deleteRequest(request: AssistanceRequest) {
        this.assistanceService.deleteRequest(request.id);
    }
}
