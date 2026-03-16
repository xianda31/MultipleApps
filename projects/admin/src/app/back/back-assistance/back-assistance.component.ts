
import { Component, OnInit } from '@angular/core';
import { AssistanceRequest, REQUEST_STATUS } from '../../common/interfaces/assistance-request.interface';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AssistanceRequestService } from '../../common/services/assistance-request.service';

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

    constructor(private assistanceService: AssistanceRequestService) { }

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
        const updated = { ...request, status: newStatus };
        this.assistanceService.updateRequest(updated);
    }
}
