import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SondageService, SurveyType } from '../sondage.service';

interface QuestionForm {
  id?: string;
  text: string;
  isInvitation?: boolean;                       // true = Question d'invitation (order = -1)
  options: { text: string; keyword: string }[];  // texte + mot-clef court
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

  showPreview = false;
  @ViewChild('previewFrame') previewFrame!: ElementRef<HTMLIFrameElement>;

  isNew = true;
  surveyId = '';
  saving = false;
  saveError: string | null = null;

  title = '';
  description = '';
  footerNote = '';
  closingDate = '';

  @ViewChild('descriptionEditor') descriptionEditor!: ElementRef<HTMLDivElement>;

  questions: QuestionForm[] = [];

  get invitationQuestion(): QuestionForm | null {
    return this.questions.find(q => q.isInvitation) ?? null;
  }
  get regularQuestions(): QuestionForm[] {
    return this.questions.filter(q => !q.isInvitation);
  }

  async ngOnInit() {
    this.surveyId = this.route.snapshot.paramMap.get('id') ?? 'new';
    this.isNew = this.surveyId === 'new';

    if (!this.isNew) {
      const survey = await this.sondageService.getSurvey(this.surveyId);
      if (survey) {
        this.title = survey.title;
        this.description = survey.description ?? '';
        this.footerNote = (survey as any).footerNote ?? '';
        this.closingDate = survey.closingDate;
        setTimeout(() => {
          if (this.descriptionEditor) {
            this.descriptionEditor.nativeElement.innerHTML = this.description;
          }
        });
      }
      const qs = await this.sondageService.listQuestionsForSurvey(this.surveyId);
      this.questions = qs.map((q: any) => ({
        id: q.id,
        text: q.text,
        isInvitation: q.order === -1,
        options: (q.options ?? []).map((t: string, i: number) => ({
          text: t,
          keyword: (q.optionKeywords ?? [])[i] ?? '',
        })),
      }));
    }

    if (this.regularQuestions.length === 0) this.addQuestion();
  }

  addQuestion() {
    this.questions.push({ text: '', options: [{ text: '', keyword: '' }, { text: '', keyword: '' }] });
  }

  addInvitationQuestion() {
    if (this.invitationQuestion) return;
    this.questions.unshift({ text: 'Serez-vous présent(e) ?', isInvitation: true, options: [{ text: 'Je ne viens pas', keyword: 'Absent' }, { text: 'Je serai présent(e)', keyword: 'Présent' }] });
  }

  removeInvitationQuestion() {
    const idx = this.questions.findIndex(q => q.isInvitation);
    if (idx !== -1) this.questions.splice(idx, 1);
  }

  removeQuestion(index: number) {
    this.questions.splice(index, 1);
  }

  addOption(q: QuestionForm) {
    if (q.options.length < 4) q.options.push({ text: '', keyword: '' });
  }

  removeOption(q: QuestionForm, i: number) {
    if (q.options.length > 2) q.options.splice(i, 1);
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

  async save() {
    if (!this.title.trim() || !this.closingDate) return;
    this.saving = true;
    this.saveError = null;
    const derivedType: SurveyType = this.invitationQuestion ? 'invitation' : 'poll';
    try {
      if (this.isNew) {
        const created = await this.sondageService.createSurvey({
          title: this.title.trim(),
          description: this.description.trim() || undefined,
          footerNote: this.footerNote.trim() || undefined,
          surveyType: derivedType,
          closingDate: this.closingDate,
          status: 'draft',
        });
        this.surveyId = created.id;
        this.isNew = false;
      } else {
        await this.sondageService.updateSurvey(this.surveyId, {
          title: this.title.trim(),
          description: this.description.trim() || undefined,
          footerNote: this.footerNote.trim() || undefined,
          surveyType: derivedType,
          closingDate: this.closingDate,
        });
      }

      let regularOrder = 0;
      for (const q of this.questions) {
        const validOptions = q.options.filter(o => o.text.trim());
        if (!q.text.trim() || validOptions.length < 2) continue;
        const optionTexts = validOptions.map(o => o.text.trim());
        const optionKeywords = validOptions.map(o => o.keyword.trim());
        const order = q.isInvitation ? -1 : regularOrder++;

        if (q.id) {
          await this.sondageService.updateQuestion(q.id, { text: q.text.trim(), options: optionTexts, optionKeywords, order });
        } else {
          const created = await this.sondageService.createQuestion({
            surveyId: this.surveyId, text: q.text.trim(), options: optionTexts, optionKeywords, order,
          });
          q.id = created.id;
        }
      }

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
    const isInvitation = !!this.invitationQuestion;

    const questionsHtml = this.regularQuestions
      .filter(q => q.text.trim())
      .map((q, i) => {
        const opts = q.options
          .filter(o => o.text.trim())
          .map((o) => `
            <label style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:6px;cursor:pointer;margin-bottom:6px;background:#f8f9fa">
              <input type="radio" name="q${i}" style="width:16px;height:16px">
              <span style="color:#333">${o.text}</span>
            </label>`)
          .join('');
        return `<div style="margin-bottom:24px">
          <p style="font-weight:bold;color:#333;margin:0 0 10px 0">${i + 1}. ${q.text}</p>
          ${opts}
        </div>`;
      }).join('');

    const invitationHtml = isInvitation && this.invitationQuestion ? `
      <p style="font-weight:bold;color:#333;margin:0 0 10px 0">${this.invitationQuestion.text || 'Question d\'invitation'}</p>
      ${this.invitationQuestion.options.filter(o => o.text.trim()).map((o) => `
        <label style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:6px;cursor:pointer;margin-bottom:6px;background:#f8f9fa">
          <input type="radio" name="q_inv" style="width:16px;height:16px">
          <span style="color:#333">${o.text}</span>
        </label>`).join('')}
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0">` : '';

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
        ${invitationHtml}
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
