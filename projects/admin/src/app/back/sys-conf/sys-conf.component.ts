import { Component } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SystemDataService } from '../../common/services/system-data.service';
import { SystemConfiguration } from '../../common/interfaces/system-conf.interface';
import { ToastService } from '../../common/services/toast.service';
import { FFB_proxyService, FfbClubSearchItem } from '../../common/ffb/services/ffb.service';
import { LEGACY_FFB_CLUB_IDENTITY } from '../../../../../../amplify/functions/shared/ffb-club-identity';
import { ModalDismissReasons, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { GetConfirmationComponent } from '../../common/modals/get-confirmation.component';




@Component({
  selector: 'app-sys-conf',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './sys-conf.component.html',
  styleUrl: './sys-conf.component.scss'
})
export class SysConfComponent {
  readonly seasonMonths = [
    { value: 7, label: 'juillet' },
    { value: 8, label: 'août' },
    { value: 9, label: 'septembre' },
    { value: 10, label: 'octobre' },
    { value: 11, label: 'novembre' },
    { value: 12, label: 'décembre' },
    { value: 1, label: 'janvier' },
    { value: 2, label: 'février' },
    { value: 3, label: 'mars' },
    { value: 4, label: 'avril' },
    { value: 5, label: 'mai' },
    { value: 6, label: 'juin' },
  ];

  systemFormGroup!: FormGroup;
  loaded!: boolean;
  newBankKey = '';
  newBankName = '';
  traceModeEnabled = false;
  saving = false;
  clubSearchTerm = '';
  clubSearchResults: FfbClubSearchItem[] = [];
  clubSearchPage = 1;
  clubSearchHasNextPage = false;
  clubSearchCompleted = false;
  clubSearching = false;
  clubSearchError = '';
  clubSearchOpen = false;
  activeClubIndex = -1;
  clubNameError = '';
  private clubSearchRequestedPage = 1;
  private clubSearchVersion = 0;
  private clubSearchTimer: ReturnType<typeof setTimeout> | undefined;
  private clubNameLookupVersion = 0;
  private clubNameLookup: Promise<void> | null = null;
  private initialFfbIdentity = { ...LEGACY_FFB_CLUB_IDENTITY };
  bankOptionsList: { key: string; name: string }[] = [];

  constructor(
    private systemDataService: SystemDataService,
    private toastService: ToastService,
    private fb: FormBuilder,
    private ffbService: FFB_proxyService,
    private modalService: NgbModal,
  ) {

    this.systemFormGroup = this.fb.group({
      club_identifier: [''],
      ffb_club_code: ['', [Validators.required, Validators.pattern(/^\d{7}$/)]],
      ffb_organization_id: ['', [Validators.required, Validators.pattern(/^[1-9]\d*$/)]],
      ffb_club_name: [''],
      trace_mode: [false],
      include_system_visits: [false],
      club_bank_key: [''],
      assistance_request_retention_days: [90],
      remembered_auth_session_days: [30, [Validators.required, Validators.min(1), Validators.max(30)]],
      web_push_active: [false],
      online_payment_active: [false],
      tpe_payment_active: [false],
      nfc_check_in_active: [false],
      CB_fees_account: [''],
      minimum_cb_amount: [0],
      membership_payment_warning_month: [11, [Validators.required, Validators.min(1), Validators.max(12)]],

      fee_rates: this.fb.array([
        this.fb.group({
          key: ['standard'],
          member_price: [0],
          non_member_price: [0],
          payment_preference: ['card', [Validators.required, Validators.pattern(/^(card|euro)$/)]],
        })
      ]),


      revenue_and_expense_tree: this.fb.group({
        sections: this.fb.array([
          this.fb.group({
            key: [''],
            description: ['']
          })
        ]),
        revenues: this.fb.array([
          this.fb.group({
            class: [''],
            key: [''],
            description: ['']
          })
        ]),
        expenses: this.fb.array([
          this.fb.group({
            class: [''],
            key: [''],
            description: ['']
          })
        ]),
      }),
      banks: this.fb.array([
        this.fb.group({
          key: [''],
          name: ['']
        })
      ]),

      profit_and_loss: this.fb.group({
        debit_key: [''],
        credit_key: [''],
      }),
      
    });
  }

  ngOnInit(): void {
    this.systemDataService.get_configuration()
      .subscribe({
        next: (configuration) => {
          this.loadDataInFormGroup(configuration);
          this.loaded = true;
        },
        error: (error) => {
          console.error('error', error);
          this.toastService.showError('erreur de chargement de la configuration', 'vérifiez la connexion internet');
        }
      });

    this.systemFormGroup.get('trace_mode')?.valueChanges.subscribe((value) => {
      this.traceModeEnabled = !!value;
    });
  }

  async save_configuration(): Promise<void> {
    if (this.saving) return;
    if (this.systemFormGroup.invalid) {
      this.systemFormGroup.markAllAsTouched();
      this.toastService.showWarning('Configuration', 'Corrigez les paramètres invalides avant de sauvegarder');
      return;
    }
    const new_configuration: SystemConfiguration = this.systemFormGroup.value;
    const code = new_configuration.ffb_club_code!;
    const organizationId = new_configuration.ffb_organization_id!;
    const clubChanged = code !== this.initialFfbIdentity.code || organizationId !== this.initialFfbIdentity.organizationId;
    this.saving = true;
    try {
      if (clubChanged) {
        const modal = this.modalService.open(GetConfirmationComponent, { centered: true });
        modal.componentInstance.title = 'Changement de club FFB';
        modal.componentInstance.subtitle = `Nouveau club : ${new_configuration.ffb_club_name || 'Nom non renseigné'}`;
        modal.componentInstance.message = 'La synchronisation des membres peut ajouter et modifier des fiches. Revenir au club précédent ne rétablit pas automatiquement les données. Sauvegardez-les avant de poursuivre.';
        modal.componentInstance.confirmLabel = 'Confirmer le changement';
        modal.componentInstance.cancelLabel = 'Annuler';
        modal.componentInstance.confirmButtonClass = 'btn-danger';
        modal.componentInstance.cancelButtonClass = 'btn-secondary';
        modal.componentInstance.confirmFirst = false;
        const confirmed = await modal.result.then(
          (result: unknown) => result === true,
          (reason: unknown) => {
            if (reason === ModalDismissReasons.ESC || reason === ModalDismissReasons.BACKDROP_CLICK) return false;
            throw reason;
          },
        );
        if (!confirmed) return;
      }
      if (!new_configuration.ffb_club_name && this.clubNameLookup) {
        await this.clubNameLookup;
        if (this.systemFormGroup.get('ffb_club_code')?.value === code
          && this.systemFormGroup.get('ffb_organization_id')?.value === organizationId) {
          new_configuration.ffb_club_name = this.systemFormGroup.get('ffb_club_name')?.value || '';
        }
      }
      if (clubChanged) {
        new_configuration.ffb_club_name = await this.ffbService.validateClubIdentity(code, organizationId);
      }
      await this.systemDataService.save_configuration(new_configuration);
      this.initialFfbIdentity = { code, organizationId };
      this.systemFormGroup.get('ffb_club_name')?.setValue(new_configuration.ffb_club_name || '', { emitEvent: false });
      this.systemFormGroup.markAsPristine();
      this.toastService.showSuccess('configuration sauvegardée', 'les nouvelles données ont été enregistrées');
    } catch (error) {
      console.error('Erreur de sauvegarde de la configuration', error);
      this.toastService.showError('Configuration', 'Sauvegarde impossible : vérifiez les identifiants FFB et la connexion.');
    } finally {
      this.saving = false;
    }
  }

  onClubSearchChange(value: string): void {
    if (this.clubSearchTimer) clearTimeout(this.clubSearchTimer);
    this.clubSearchTimer = undefined;
    this.clubSearchTerm = value;
    this.clubSearchVersion++;
    this.clubSearching = false;
    this.clubSearchResults = [];
    this.clubSearchCompleted = false;
    this.clubSearchError = '';
    this.clubSearchHasNextPage = false;
    this.clubSearchOpen = value.trim().length >= 2 && value.trim().length <= 100;
    this.activeClubIndex = -1;
    if (value.trim().length >= 2 && value.trim().length <= 100) {
      this.clubSearchTimer = setTimeout(() => {
        this.clubSearchTimer = undefined;
        void this.searchClubs();
      }, 300);
    }
  }

  async searchClubs(page = 1): Promise<void> {
    if (this.clubSearchTimer) clearTimeout(this.clubSearchTimer);
    this.clubSearchTimer = undefined;
    const label = this.clubSearchTerm.trim();
    if (label.length < 2 || label.length > 100) {
      this.clubSearchError = 'Saisissez entre 2 et 100 caractères.';
      return;
    }
    const version = ++this.clubSearchVersion;
    this.clubSearchRequestedPage = page;
    this.clubSearching = true;
    this.clubSearchCompleted = false;
    this.clubSearchError = '';
    this.activeClubIndex = -1;
    try {
      const result = await this.ffbService.searchClubs(label, page);
      if (version !== this.clubSearchVersion) return;
      this.clubSearchResults = result.clubs;
      this.clubSearchPage = page;
      this.clubSearchHasNextPage = result.hasNextPage;
      this.clubSearchCompleted = true;
      this.activeClubIndex = result.clubs.length ? 0 : -1;
    } catch (error) {
      if (version !== this.clubSearchVersion) return;
      console.error('Erreur de recherche des clubs FFB', error);
      this.clubSearchResults = [];
      this.clubSearchHasNextPage = false;
      this.clubSearchError = 'Recherche FFB impossible. Réessayez.';
    } finally {
      if (version === this.clubSearchVersion) this.clubSearching = false;
    }
  }

  get clubSearchPanelVisible(): boolean {
    return this.clubSearchOpen && (this.clubSearching || this.clubSearchCompleted || !!this.clubSearchError);
  }

  onClubSearchFocus(): void {
    const length = this.clubSearchTerm.trim().length;
    this.clubSearchOpen = length >= 2 && length <= 100;
  }

  onClubSearchFocusOut(event: FocusEvent): void {
    const container = event.currentTarget as HTMLElement;
    if (!(event.relatedTarget instanceof Node) || !container.contains(event.relatedTarget)) {
      this.clubSearchOpen = false;
    }
  }

  onClubSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.clubSearchOpen = false;
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!this.clubSearchResults.length || this.clubSearching) return;
      event.preventDefault();
      this.clubSearchOpen = true;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.activeClubIndex = this.activeClubIndex < 0
        ? (step > 0 ? 0 : this.clubSearchResults.length - 1)
        : (this.activeClubIndex + step + this.clubSearchResults.length) % this.clubSearchResults.length;
      const input = event.currentTarget as HTMLInputElement;
      input.ownerDocument.getElementById(`ffb-club-option-${this.activeClubIndex}`)?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.clubSearchPanelVisible && !this.clubSearching && this.activeClubIndex >= 0) {
        this.selectClub(this.clubSearchResults[this.activeClubIndex]);
      } else if (!this.clubSearchCompleted && !this.clubSearching) {
        this.clubSearchOpen = true;
        void this.searchClubs();
      }
    }
  }

  retryClubSearch(): void {
    void this.searchClubs(this.clubSearchRequestedPage);
  }

  selectClub(club: FfbClubSearchItem): void {
    this.clubNameLookupVersion++;
    this.clubNameLookup = null;
    this.clubNameError = '';
    this.systemFormGroup.patchValue({
      ffb_club_name: club.name,
      ffb_club_code: club.code,
      ffb_organization_id: club.organizationId,
    });
    this.systemFormGroup.markAsDirty();
    this.onClubSearchChange('');
  }

  ngOnDestroy(): void {
    if (this.clubSearchTimer) clearTimeout(this.clubSearchTimer);
    this.clubSearchVersion++;
    this.clubNameLookupVersion++;
  }

  private async loadMissingClubName(code: string, organizationId: string): Promise<void> {
    const version = ++this.clubNameLookupVersion;
    try {
      const name = await this.ffbService.validateClubIdentity(code, organizationId);
      if (version !== this.clubNameLookupVersion) return;
      if (this.systemFormGroup.get('ffb_club_code')?.value !== code
        || this.systemFormGroup.get('ffb_organization_id')?.value !== organizationId
        || this.systemFormGroup.get('ffb_club_name')?.value) return;
      this.systemFormGroup.get('ffb_club_name')?.setValue(name, { emitEvent: false });
    } catch (error) {
      if (version !== this.clubNameLookupVersion) return;
      console.warn('Nom du club FFB indisponible', error);
      this.clubNameError = 'Nom du club indisponible ; recherchez-le pour le renseigner.';
    }
  }

  get expenses() {
    return this.systemFormGroup.get('revenue_and_expense_tree')?.get('expenses') as FormArray;
  }

  get revenues() {
    return this.systemFormGroup.get('revenue_and_expense_tree')?.get('revenues') as FormArray;
  }

  get fee_rates() {
    return this.systemFormGroup.get('fee_rates') as FormArray;
  }

  get sections() {
    return this.systemFormGroup.get('revenue_and_expense_tree')?.get('sections') as FormArray;
  }

  get banks() {
    return this.systemFormGroup.get('banks') as FormArray;
  }

  get includeSystemVisits(): boolean {
    return !!this.systemFormGroup.get('include_system_visits')?.value;
  }

  get webPushActive(): boolean {
    return !!this.systemFormGroup.get('web_push_active')?.value;
  }

  private computeBankOptions(): { key: string; name: string }[] {
    const seen = new Set<string>();
    return this.banks.controls
      .map(ctrl => ({
        key: String(ctrl.get('key')?.value ?? '').trim(),
        name: String(ctrl.get('name')?.value ?? '').trim(),
      }))
      .filter(bank => {
        if (!bank.key || seen.has(bank.key)) return false;
        seen.add(bank.key);
        return true;
      });
  }

  private refreshBankOptions(): void {
    this.bankOptionsList = this.computeBankOptions();
  }

  // Ajoute un nouveau code banque '???'/'autre'
  addBankCode(): void {
    const banks = this.banks;
    if (!banks) return;
    // Vérifie si le dernier élément est bien '???'
    const last = banks.at(banks.length - 1);
    if (!last || last.get('key')?.value !== '???') {
      banks.push(this.fb.group({ key: ['???'], name: ['autre'] }));
      this.refreshBankOptions();
    }
  }

  addBankFromDraft(): void {
    const key = this.newBankKey.trim();
    const name = this.newBankName.trim();

    if (!key) {
      this.toastService.showInfo('banques', 'Le code banque est requis');
      return;
    }

    const exists = this.banks.controls.some(ctrl => String(ctrl.get('key')?.value ?? '').trim() === key);
    if (exists) {
      this.toastService.showInfo('banques', `Le code banque "${key}" existe déjà`);
      return;
    }

    this.banks.push(this.fb.group({ key: [key], name: [name] }));
    this.refreshBankOptions();
    this.newBankKey = '';
    this.newBankName = '';
  }

  // Quand la key du dernier code banque est modifiée, recrée '???'/'autre' si besoin
  onBankKeyChange(i: number): void {
    const banks = this.banks;
    if (!banks) return;
    // Si on modifie le dernier et qu'il n'est plus '???', on ajoute un nouveau '???'
    if (i === banks.length - 1 && banks.at(i).get('key')?.value !== '???') {
      this.addBankCode();
    }
    this.refreshBankOptions();
  }
  get club_bank(): string {
    let key = this.systemFormGroup.get('club_bank_key')?.value;
    let cntrl = this.banks.controls.find((bank) => bank.value.key === key);
    return cntrl?.value.name ?? '???';
  }

  get loss_account_key(): string {
    let key = this.systemFormGroup.get('profit_and_loss')?.get('loss_account_key')?.value;
    let cntrl = this.expenses.controls.find((account) => account.value.key === key);
    return cntrl?.value.description ?? '???';
  }
  get profit_account_key(): string {
    let key = this.systemFormGroup.get('profit_and_loss')?.get('profit_account_key')?.value;
    let cntrl = this.revenues.controls.find((account) => account.value.key === key);
    return cntrl?.value.description ?? '???';
  }

  loadDataInFormGroup(configuration: SystemConfiguration) {
    const legacy = configuration.ffb_club_code == null && configuration.ffb_organization_id == null;
    const code = legacy ? LEGACY_FFB_CLUB_IDENTITY.code : configuration.ffb_club_code ?? '';
    const organizationId = legacy ? LEGACY_FFB_CLUB_IDENTITY.organizationId : configuration.ffb_organization_id ?? '';
    this.initialFfbIdentity = { code, organizationId };
    this.clubNameLookupVersion++;
    this.clubNameLookup = null;
    this.clubNameError = '';
    this.systemFormGroup.patchValue({
      ...configuration,
      nfc_check_in_active: configuration.nfc_check_in_active ?? false,
      ffb_club_code: code,
      ffb_organization_id: organizationId,
      ffb_club_name: configuration.ffb_club_name ?? '',
      membership_payment_warning_month: configuration.membership_payment_warning_month ?? 11,
    }, { emitEvent: false });
    // patchValue doest not work for FormArray ; work-around method : clear and re-populate
    this.sections.clear();
    this.expenses.clear();
    this.revenues.clear();
    this.banks.clear();
    this.fee_rates.clear();

    configuration.revenue_and_expense_tree.sections.forEach((account: any) => {
      this.sections!.push(this.fb.group(account));
    });
    configuration.revenue_and_expense_tree.expenses.forEach((account: any) => {
      this.expenses.push(this.fb.group(account));
    }
    );
    configuration.revenue_and_expense_tree.revenues.forEach((account: any) => {
      this.revenues.push(this.fb.group(account));
    });

    configuration.fee_rates
      .filter((fee_rate) => String(fee_rate.key) !== 'accession')
      .forEach((fee_rate) => {
        this.fee_rates.push(this.fb.group({
          ...fee_rate,
          payment_preference: [fee_rate.payment_preference ?? 'card', [Validators.required, Validators.pattern(/^(card|euro)$/)]],
        }));
      });


    configuration.banks.forEach((bank: any) => {
      this.banks.push(this.fb.group(bank));
    });

    this.refreshBankOptions();
    this.traceModeEnabled = !!this.systemFormGroup.get('trace_mode')?.value;
    if (!configuration.ffb_club_name && /^\d{7}$/.test(code) && /^[1-9]\d*$/.test(organizationId)) {
      this.clubNameLookup = this.loadMissingClubName(code, organizationId);
    }

  }

}
