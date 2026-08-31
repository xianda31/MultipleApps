import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SondageService } from '../sondage.service';
import { ProductService } from '../../../common/services/product.service';
import { Product } from '../../products/product.interface';
import { Member } from '../../../common/interfaces/member.interface';
import { MembersService, MemberStatus } from '../../../common/services/members.service';
import {
  requiresSurveyReconfirmation,
  SurveyAnswers,
  SurveyDetailOption,
  SurveyOptionDefinition,
  SurveyQuestionDefinition,
  validatePaymentTag,
} from '../../../common/survey/survey-flow';

interface QuestionForm {
  id?: string;
  text: string;
  resultLabel: string;
  detailResultLabel: string;
  options: SurveyOptionDefinition[];
}

@Component({
  selector: 'app-sondage-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sondage-editor.component.html',
  styles: [`
    [contenteditable]:empty:before {
      content: attr(placeholder);
      color: #6c757d;
      pointer-events: none;
      display: block;
    }
  `]
})
export class SondageEditorComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sondageService = inject(SondageService);
  private productService = inject(ProductService);
  private membersService = inject(MembersService);

  showPreview = false;
  @ViewChild('previewFrame') previewFrame!: ElementRef<HTMLIFrameElement>;

  isNew = true;
  surveyId = '';
  saving = false;
  saveError: string | null = null;
  hasResponses = false;

  title = '';
  description = '';
  footerNote = '';
  closingDate = '';
  status: 'active' | 'closed' = 'active';
  // Holds selected SaleItem.id (legacy surveys may still have stored product name).
  tag = '';
  pafProducts: Product[] = [];
  @ViewChild('descriptionEditor') descriptionEditor!: ElementRef<HTMLDivElement>;

  questions: QuestionForm[] = [];
  memberImportOpen = false;
  memberImportLoading = false;
  memberImportSearch = '';
  includeNonMembers = false;
  importMembers: Member[] = [];
  selectedImportMemberIds = new Set<string>();
  private importTargetOption: SurveyOptionDefinition | null = null;
  private persistedQuestionIds = new Set<string>();
  private originalQuestions: SurveyQuestionDefinition[] = [];
  private responseSnapshots: Array<{ id: string; answers: SurveyAnswers }> = [];

  get filteredImportMembers(): Member[] {
    const search = this.memberImportSearch.trim().toLocaleLowerCase('fr');
    return this.importMembers.filter(member => {
      const isClubMember = this.membersService.resolveMemberStatus(member) !== MemberStatus.NON_ADHERENT;
      if (!this.includeNonMembers && !isClubMember) return false;
      return !search || `${member.lastname} ${member.firstname}`.toLocaleLowerCase('fr').includes(search);
    });
  }

  get allVisibleMembersSelected(): boolean {
    return this.filteredImportMembers.length > 0
      && this.filteredImportMembers.every(member => this.selectedImportMemberIds.has(member.id));
  }

  get paymentOption(): SurveyOptionDefinition | null {
    return this.questions.flatMap(question => question.options).find(option => option.payTag) ?? null;
  }

  detailOptionCount(option: SurveyOptionDefinition): number {
    return option.detailOptions?.length ?? 0;
  }

  async ngOnInit() {
    const products = await firstValueFrom(this.productService.listProducts());
    this.pafProducts = (products ?? []) ; // .filter(p => p.account === 'PAF'); tous les produits peuvent être proposés ; c'est plus général

    this.surveyId = this.route.snapshot.paramMap.get('id') ?? 'new';
    this.isNew = this.surveyId === 'new';

    if (!this.isNew) {
      const survey = await this.sondageService.getSurvey(this.surveyId);
      if (survey) {
        this.title = survey.title;
        this.description = survey.description ?? '';
        this.footerNote = (survey as any).footerNote ?? '';
        this.closingDate = survey.closingDate;
        this.status = (survey.status ?? 'active') as 'active' | 'closed';
        this.tag = this.resolveProductId(survey.productTag ?? '');
        setTimeout(() => {
          if (this.descriptionEditor) {
            this.descriptionEditor.nativeElement.innerHTML = this.description;
          }
        });
      }
      const qs = await this.sondageService.listQuestionsForSurvey(this.surveyId);
      this.persistedQuestionIds = new Set(qs.map(question => question.id));
      this.questions = qs.map((q: any) => ({
        id: q.id,
        text: q.text,
        resultLabel: q.resultLabel ?? '',
        detailResultLabel: q.detailResultLabel ?? '',
        options: (q.options ?? []).map((option: any) => ({
          value: option.value,
          label: option.label,
          keyword: option.keyword ?? '',
          nextAction: option.nextAction ?? 'NEXT',
          payTag: option.payTag === true,
          detailPrompt: option.detailPrompt ?? '',
          detailOptions: option.detailOptions ?? [],
          detailOptionsOrigin: option.detailOptionsOrigin ?? 'manual',
        })),
      }));
      const responses = await this.sondageService.listResponsesForSurvey(this.surveyId);
      this.hasResponses = responses.length > 0;
      this.originalQuestions = this.toQuestionDefinitions(this.questions);
      this.responseSnapshots = responses.map((response: any) => ({
        id: response.id,
        answers: this.parseAnswers(response.answers),
      }));
    }

    if (!this.tag && this.pafProducts.length === 1) {
      this.tag = this.pafProducts[0].id;
    }

    if (this.questions.length === 0) this.addQuestion();
  }

  addQuestion() {
    this.questions.push({
      text: '',
      resultLabel: '',
      detailResultLabel: '',
      options: [this.createEmptyOption(), this.createEmptyOption()],
    });
  }

  removeQuestion(index: number) {
    if (this.hasResponses && !confirm('Supprimer cette question peut rendre des votes existants obsolètes. Continuer ?')) return;
    this.questions.splice(index, 1);
  }

  addOption(q: QuestionForm) {
    q.options.push(this.createEmptyOption());
  }

  removeOption(q: QuestionForm, i: number) {
    if (this.hasResponses && !confirm('Supprimer cette réponse peut nécessiter la reconfirmation de certains votes. Continuer ?')) return;
    if (q.options.length > 2) q.options.splice(i, 1);
  }

  addDetailList(option: SurveyOptionDefinition) {
    option.detailPrompt = 'Sélectionnez une valeur';
    option.detailOptionsOrigin = 'manual';
    option.detailOptions = [this.createEmptyDetailOption(), this.createEmptyDetailOption()];
  }

  addDetailOption(option: SurveyOptionDefinition) {
    option.detailOptions ??= [];
    option.detailOptions.push(this.createEmptyDetailOption());
  }

  removeDetailOption(option: SurveyOptionDefinition, index: number) {
    if (!option.detailOptions || option.detailOptions.length <= 1) return;
    if (this.hasResponses && !confirm('Supprimer cette valeur peut nécessiter la reconfirmation de certains votes. Continuer ?')) return;
    option.detailOptions.splice(index, 1);
  }

  clearDetailList(option: SurveyOptionDefinition) {
    if (this.hasResponses && !confirm('Supprimer cette liste peut nécessiter la reconfirmation de certains votes. Continuer ?')) return;
    option.detailPrompt = undefined;
    option.detailOptions = [];
    option.detailOptionsOrigin = undefined;
  }

  setPayTag(option: SurveyOptionDefinition, enabled: boolean) {
    this.clearPaymentTags();
    option.payTag = enabled;
  }

  private clearPaymentTags() {
    for (const question of this.questions) {
      for (const candidate of question.options) candidate.payTag = false;
    }
  }

  onProductChange(productId: string) {
    this.tag = productId;
    if (!productId) this.clearPaymentTags();
  }

  toggleNextAction(option: SurveyOptionDefinition) {
    option.nextAction = option.nextAction === 'END' ? 'NEXT' : 'END';
  }

  async openMemberImport(option: SurveyOptionDefinition) {
    this.importTargetOption = option;
    this.memberImportSearch = '';
    this.includeNonMembers = false;
    this.selectedImportMemberIds = new Set(
      option.detailOptionsOrigin === 'memberImport' ? (option.detailOptions ?? []).map(detail => detail.value) : []
    );
    this.memberImportOpen = true;
    this.memberImportLoading = true;
    try {
      this.importMembers = await firstValueFrom(this.membersService.listMembers());
    } finally {
      this.memberImportLoading = false;
    }
  }

  closeMemberImport() {
    this.memberImportOpen = false;
    this.importTargetOption = null;
  }

  toggleImportMember(memberId: string) {
    if (this.selectedImportMemberIds.has(memberId)) {
      this.selectedImportMemberIds.delete(memberId);
    } else {
      this.selectedImportMemberIds.add(memberId);
    }
    this.selectedImportMemberIds = new Set(this.selectedImportMemberIds);
  }

  toggleAllVisibleMembers() {
    const select = !this.allVisibleMembersSelected;
    for (const member of this.filteredImportMembers) {
      if (select) this.selectedImportMemberIds.add(member.id);
      else this.selectedImportMemberIds.delete(member.id);
    }
    this.selectedImportMemberIds = new Set(this.selectedImportMemberIds);
  }

  applyMemberImport() {
    if (!this.importTargetOption) return;
    this.importTargetOption.detailPrompt ||= 'Sélectionnez un membre';
    this.importTargetOption.detailOptionsOrigin = 'memberImport';
    this.importTargetOption.detailOptions = this.importMembers
      .filter(member => this.selectedImportMemberIds.has(member.id))
      .sort((a, b) => `${a.lastname} ${a.firstname}`.localeCompare(`${b.lastname} ${b.firstname}`, 'fr'))
      .map(member => ({
        label: `${member.lastname.toLocaleUpperCase('fr')} ${member.firstname}`.trim(),
        value: member.id,
      }));
    this.closeMemberImport();
  }

  private createEmptyOption() {
    return {
      label: '', keyword: '', value: this.createOptionValue(), nextAction: 'NEXT' as const, payTag: false,
      detailPrompt: '', detailOptions: [], detailOptionsOrigin: undefined,
    };
  }

  private createEmptyDetailOption(): SurveyDetailOption {
    return { label: '', value: this.createOptionValue() };
  }

  private createOptionValue(): string {
    return globalThis.crypto?.randomUUID?.() ?? `option-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private parseAnswers(raw: unknown): SurveyAnswers {
    let parsed = raw;
    while (typeof parsed === 'string') parsed = JSON.parse(parsed);
    return parsed && typeof parsed === 'object' ? parsed as SurveyAnswers : {};
  }

  private toQuestionDefinitions(questions: QuestionForm[]): SurveyQuestionDefinition[] {
    return questions.flatMap((question, order) => {
      const options = question.options
        .filter(option => option.label.trim())
        .map(option => ({
          ...option,
          label: option.label.trim(),
          keyword: option.keyword?.trim() || undefined,
          detailPrompt: option.detailOptions?.length ? option.detailPrompt?.trim() || undefined : undefined,
          detailOptions: option.detailOptions?.length
            ? option.detailOptions.filter(detail => detail.label.trim()).map(detail => ({
                value: detail.value,
                label: detail.label.trim(),
              }))
            : undefined,
          detailOptionsOrigin: option.detailOptions?.length ? option.detailOptionsOrigin : undefined,
        }));
      return question.id && question.text.trim() && options.length >= 2
        ? [{
            id: question.id,
            order,
            text: question.text.trim(),
            resultLabel: question.resultLabel.trim() || undefined,
            detailResultLabel: question.detailResultLabel.trim() || undefined,
            options,
          }]
        : [];
    });
  }

  onDescriptionInput(event: Event) {
    this.description = (event.target as HTMLDivElement).innerHTML;
  }

  applyBold() {
    this.descriptionEditor.nativeElement.focus();
    document.execCommand('bold');
    this.description = this.descriptionEditor.nativeElement.innerHTML;
  }

  trackByIndex(index: number) { return index; }

  private resolveProductId(storedProductTag: string): string {
    const value = (storedProductTag ?? '').trim();
    if (!value) return '';
    if (this.pafProducts.some(p => p.id === value)) return value;
    return this.pafProducts.find(p => p.name === value)?.id ?? '';
  }

  async save() {
    if (!this.title.trim() || !this.closingDate) return;
    if (!validatePaymentTag(this.questions as any)) {
      this.saveError = 'Une seule réponse peut déclencher le paiement.';
      return;
    }
    if (this.paymentOption && !this.tag) {
      this.saveError = 'Sélectionnez un produit pour la réponse qui déclenche le paiement.';
      return;
    }
    this.saving = true;
    this.saveError = null;
    try {
      if (this.isNew) {
        const created = await this.sondageService.createSurvey({
          title: this.title.trim(),
          description: this.description.trim() || undefined,
          footerNote: this.footerNote.trim() || undefined,
          productTag: this.tag || undefined,
          closingDate: this.closingDate,
          status: 'active',
        });
        this.surveyId = created.id;
        this.isNew = false;
      } else {
        await this.sondageService.updateSurvey(this.surveyId, {
          title: this.title.trim(),
          description: this.description.trim() || undefined,
          footerNote: this.footerNote.trim() || undefined,
          productTag: this.tag || undefined,
          closingDate: this.closingDate,
          status: this.status,
        });
      }

      for (const [order, q] of this.questions.entries()) {
        const validOptions = q.options.filter(option => option.label.trim());
        if (!q.text.trim() || validOptions.length < 2) continue;
        const questionInput = {
          text: q.text.trim(),
          resultLabel: q.resultLabel.trim() || undefined,
          detailResultLabel: q.detailResultLabel.trim() || undefined,
          options: validOptions.map(option => ({
            value: option.value,
            label: option.label.trim(),
            keyword: option.keyword?.trim() || undefined,
            nextAction: option.nextAction,
            payTag: option.payTag || undefined,
            detailPrompt: option.detailOptions?.length ? option.detailPrompt?.trim() || undefined : undefined,
            detailOptions: option.detailOptions?.length
              ? option.detailOptions.filter(detail => detail.label.trim()).map(detail => ({
                  value: detail.value, label: detail.label.trim(),
                }))
              : undefined,
            detailOptionsOrigin: option.detailOptions?.length ? option.detailOptionsOrigin : undefined,
          })),
          order,
        };

        if (q.id) {
          await this.sondageService.updateQuestion(q.id, questionInput);
        } else {
          const created = await this.sondageService.createQuestion({
            surveyId: this.surveyId, ...questionInput,
          });
          q.id = created.id;
        }
      }

      const retainedQuestionIds = new Set(this.questions.map(question => question.id).filter(Boolean));
      for (const questionId of this.persistedQuestionIds) {
        if (!retainedQuestionIds.has(questionId)) {
          await this.sondageService.deleteQuestion(questionId);
        }
      }

      const nextQuestions = this.toQuestionDefinitions(this.questions);
      const affectedResponses = this.responseSnapshots.filter(response =>
        requiresSurveyReconfirmation(this.originalQuestions, nextQuestions, response.answers)
      );
      await Promise.all(affectedResponses.map(response =>
        this.sondageService.requireResponseReconfirmation(response.id)
      ));

      this.router.navigate(['/back/communication/sondage']);
    } catch (err: any) {
      console.error('[save] erreur sauvegarde sondage', err);
      this.saveError = err?.errors?.[0]?.message ?? err?.message ?? 'Erreur lors de la sauvegarde';
    } finally {
      this.saving = false;
    }
  }

  cancel() {
    this.router.navigate(['/back/communication/sondage']);
  }

  async duplicateSurvey() {
    if (this.isNew || this.saving || !this.title.trim() || !this.closingDate) return;
    this.saving = true;
    this.saveError = null;
    try {
      const copy = await this.sondageService.createSurvey({
        title: `${this.title.trim()} (copie)`,
        description: this.description.trim() || undefined,
        footerNote: this.footerNote.trim() || undefined,
        productTag: this.tag || undefined,
        closingDate: this.closingDate,
        status: 'active',
      });

      for (const [order, question] of this.questions.entries()) {
        const options = question.options
          .filter(option => option.label.trim())
          .map(option => ({
            ...option,
            value: this.createOptionValue(),
            label: option.label.trim(),
            keyword: option.keyword?.trim() || undefined,
            payTag: option.payTag || undefined,
            detailPrompt: option.detailOptions?.length ? option.detailPrompt?.trim() || undefined : undefined,
            detailOptions: option.detailOptions?.length
              ? option.detailOptions.filter(detail => detail.label.trim()).map(detail => ({
                  value: option.detailOptionsOrigin === 'memberImport' ? detail.value : this.createOptionValue(),
                  label: detail.label.trim(),
                }))
              : undefined,
            detailOptionsOrigin: option.detailOptions?.length ? option.detailOptionsOrigin : undefined,
          }));
        if (!question.text.trim() || options.length < 2) continue;
        await this.sondageService.createQuestion({
          surveyId: copy.id,
          text: question.text.trim(),
          resultLabel: question.resultLabel.trim() || undefined,
          detailResultLabel: question.detailResultLabel.trim() || undefined,
          options,
          order,
        });
      }

      await this.router.navigate(['/back/communication/sondage/editor', copy.id]);
    } catch (err: any) {
      this.saveError = err?.errors?.[0]?.message ?? err?.message ?? 'Erreur lors de la duplication';
    } finally {
      this.saving = false;
    }
  }

  togglePreview() {
    this.showPreview = !this.showPreview;
    if (this.showPreview) {
      this.previewFrame.nativeElement.srcdoc = this.buildPreviewHtml();
    }
  }

  private buildPreviewHtml(): string {
    const desc = this.description || '';
    const closingFmt = this.closingDate
      ? new Date(this.closingDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'date de clôture';
    const questionsHtml = this.questions
      .filter(q => q.text.trim())
      .map((q, i) => {
        const validOptions = q.options.filter(option => option.label.trim());
        const opts = validOptions.map((option) => `
            <label style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:6px;cursor:pointer;margin-bottom:6px;background:#f8f9fa">
              <input type="radio" name="q${i}" style="width:16px;height:16px">
              <span style="color:#333">${option.label}</span>
              ${option.detailOptions?.length ? `<select style="margin-left:auto;padding:6px 10px;border:1px solid #ced4da;border-radius:6px;background:white;color:#333">
                <option>${option.detailPrompt || 'Sélectionnez une valeur'}</option>
                ${option.detailOptions.slice(0, 5).map(detail => `<option>${detail.label}</option>`).join('')}
              </select>` : ''}
            </label>`)
          .join('');
        return `<div style="margin-bottom:24px">
          <p style="font-weight:bold;color:#333;margin:0 0 10px 0">${i + 1}. ${q.text}</p>
          ${opts}
        </div>`;
      }).join('');

    const submitHtml = `
      <button style="width:100%;padding:14px;background:#667eea;color:white;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;margin-top:8px">
        Soumettre ma réponse
      </button>`;

    return `<!DOCTYPE html><html><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>*{box-sizing:border-box}body{margin:0;padding:24px 16px;background:#f5f7fa;font-family:Arial,Helvetica,sans-serif}</style>
    </head><body>
    <div style="max-width:620px;margin:0 auto">
      <div style="text-align:center;margin-bottom:28px">
        <p style="color:#888;font-size:13px;margin:4px 0">Bridge Club Saint-Orens</p>
      </div>
      <div style="background:white;border-radius:10px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
        <p style="font-size:16px;color:#333;margin:0 0 6px 0">Bonjour <strong>Prénom</strong>,</p>
        <p style="font-size:13px;color:#aaa;margin:0 0 24px 0">
          Ce formulaire vous est adressé personnellement ; merci de ne pas le partager.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:0 0 24px 0">
        <h1 style="font-size:20px;color:#333;margin:0 0 10px 0">${this.title || 'Titre du sondage'}</h1>
        ${desc ? `<p style="font-size:15px;color:#555;line-height:1.7;margin:0 0 24px 0">${desc}</p>` : ''}
        ${questionsHtml}
        ${submitHtml}
        ${this.footerNote.trim() ? `<p style="color:#aaa;font-size:12px;margin-top:28px;text-align:center">${this.footerNote.trim()}</p>` : ''}
        <p style="color:#aaa;font-size:12px;margin-top:24px;text-align:center">
          Ce lien est personnel et nominatif — valable jusqu'au ${closingFmt}.
        </p>
      </div>
      <p style="text-align:center;color:#ccc;font-size:11px;margin-top:24px">lien personnel, ne pas partager</p>
    </div>
    </body></html>`;
  }
}
