
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AssistanceRequestService } from '../../../common/services/assistance-request.service';
import { CommonModule } from '@angular/common';
import { REQUEST_STATUS, REQUEST_TYPES } from '../../../common/interfaces/assistance-request.interface';
import { TitleService } from '../../title/title.service';
import { environment } from '../../../../environments/environment';
import type { BuildInfo } from '../../../../environments/build-info.interface';


@Component({
    selector: 'app-assistance',
    templateUrl: './assistance.component.html',
    styleUrls: ['./assistance.component.scss'],
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule
    ]
})
export class AssistanceComponent {
    form: FormGroup;
    requestTypes = REQUEST_TYPES;
    submitted = false;
    loading = false;
    success = false;
    error: string | null = null;

    constructor(
        private fb: FormBuilder,
        private assistanceRequestService: AssistanceRequestService,
        private titleService: TitleService
    ) {

        this.titleService.setTitle('Demande d\'assistance ');
        this.form = this.fb.group({
            nom: ['', Validators.required],
            prenom: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
            type: ['', Validators.required],
            texte: ['', Validators.required],
            status: [REQUEST_STATUS.NEW, Validators.required],
        });
    }

    async onSubmit() {
        this.submitted = true;
        this.error = null;
        if (this.form.invalid) return;
        this.loading = true;
        try {
            const formData = this.form.value;
            // Enrichir le texte avec les infos de déploiement
            const buildInfo: BuildInfo = environment.buildInfo;
            const buildLabel = buildInfo.buildNumber 
              ? `build #${buildInfo.buildNumber} (${buildInfo.commitHash})`
              : `build ${buildInfo.commitHash} (local)`;
            const enrichedText = `${formData.texte}\n\n---\nBuild/Déploiement: ${buildLabel}\nDate rapport: ${new Date().toISOString()}`;
            
            await this.assistanceRequestService.createRequest({
                ...formData,
                texte: enrichedText
            });
            this.success = true;
            this.form.reset();
            this.submitted = false;
        } catch (e: any) {
            this.error = e?.message || 'Erreur lors de l’envoi.';
        } finally {
            this.loading = false;
        }
    }

    goBack() {
        window.history.back();
    }
}
