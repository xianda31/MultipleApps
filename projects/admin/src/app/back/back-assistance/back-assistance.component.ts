
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
    editingStatus: { [id: string]: boolean } = {};
    statusOptions = [
        { value: REQUEST_STATUS.NEW, label: 'Nouveau' },
        { value: REQUEST_STATUS.IN_PROGRESS, label: 'En cours' },
        { value: REQUEST_STATUS.RESOLVED, label: 'Résolu' }
    ];

    statusFilter: string = '';

    getStatusLabel(status: string): string {
        const found = this.statusOptions.find((s: { value: string; label: string }) => s.value === status);
        return found ? found.label : status;
    }

    constructor(private assistanceService: AssistanceRequestService) { }

    ngOnInit() {
        this.assistanceService.getAllRequests().subscribe(requests => {
            this.requests = requests;
        });
    }
    get filteredRequests(): AssistanceRequest[] {
        if (!this.statusFilter) return this.requests;
        return this.requests.filter(r => r.status === this.statusFilter);
    }

    enableEdit(id: string) {
        this.editingStatus[id] = true;
    }

    async updateStatus(request: AssistanceRequest, newStatus: string) {
        const updated = { ...request, status: newStatus };
        await this.assistanceService.updateRequest(updated);
        this.editingStatus[request.id] = false;
    }
}
