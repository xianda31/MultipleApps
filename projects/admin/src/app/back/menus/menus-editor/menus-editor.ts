import { Component, ViewChild, ViewChildren, QueryList, Inject, ChangeDetectorRef, ElementRef, AfterViewInit } from '@angular/core';
import { NgbOffcanvas, NgbOffcanvasRef } from '@ng-bootstrap/ng-bootstrap';
import { ToastService } from '../../../common/services/toast.service';
import { NavItemsService } from '../../../common/services/navitem.service';
import { MenuStructure, MenuGroup, NavItem, NAVITEM_LOGGING_CRITERIA, NAVITEM_POSITION, NAVITEM_TYPE } from '../../../common/interfaces/navitem.interface';
import { NAVITEM_COMMAND } from '../../../common/interfaces/plugin.interface';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Routes } from '@angular/router';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { NAVITEM_PLUGIN, PLUGINS_META, PluginParamDef } from '../../../common/interfaces/plugin.interface';
import { LABEL_TRANSFORMERS } from '../../../common/interfaces/plugin.interface';
import { PageService } from '../../../common/services/page.service';
import { CLIPBOARD_TITLE, Page, PAGE_TEMPLATES } from '../../../common/interfaces/page_snippet.interface';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CdkDragDrop, moveItemInArray, CdkDragStart } from '@angular/cdk/drag-drop';
import { NgbDropdown } from '@ng-bootstrap/ng-bootstrap';
import { APP_SANDBOX } from '../../../app.config';
import { SandboxService } from '../../../common/services/sandbox.service';
import { DynamicRoutesService } from '../../../common/services/dynamic-routes.service';
import { Subject, combineLatest, firstValueFrom, first } from 'rxjs';
import { charsanitize, buildFullPath, extractSegment } from '../../../common/utils/navitem.utils';

@Component({
  selector: 'app-menus-editor',
  standalone: true,
  templateUrl: './menus-editor.html',
  styleUrls: ['./menus-editor.scss'],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbDropdownModule, DragDropModule]
})
export class MenusEditorComponent implements AfterViewInit {
    // snippets: any[] = [];
  navbarEntries: MenuGroup[] = [];
  private _visibleNavbarEntries: MenuGroup[] = [];
  footbarEntries: MenuGroup[] = [];
  private _visibleFootbarEntries: MenuGroup[] = [];
  @ViewChild('editNavitemOffcanvas', { static: true }) editNavitemOffcanvas: any;
  @ViewChild('navDropList', { static: false, read: ElementRef }) navDropListRef?: ElementRef;
  @ViewChildren(NgbDropdown) dropdowns?: QueryList<NgbDropdown>;

  selectedNavitem: NavItem | null = null;
  navitems!: NavItem[];
  NAVITEM_TYPE = NAVITEM_TYPE;
  NAVITEM_TYPES = Object.values(NAVITEM_TYPE);
  NAVITEM_POSITION = NAVITEM_POSITION;
  NAVITEM_POSITIONS = Object.values(NAVITEM_POSITION);
  ORDERED_NAVITEM_POSITIONS = [NAVITEM_POSITION.BRAND, NAVITEM_POSITION.NAVBAR, NAVITEM_POSITION.FOOTER];
  NAVITEM_PLUGIN = NAVITEM_PLUGIN;
  NAVITEM_PLUGINS = Object.values(NAVITEM_PLUGIN);
  NAVITEM_LOGGING_CRITERIA = NAVITEM_LOGGING_CRITERIA;
  NAVITEM_LOGGING_CRITERIA_VALUES = Object.values(NAVITEM_LOGGING_CRITERIA);
  NAVITEM_COMMAND = NAVITEM_COMMAND;
  NAVITEM_COMMANDS = Object.values(NAVITEM_COMMAND);

  front_route_verbose = '';
  // selectedPageId: string | undefined = undefined;
  // Preview auth state toggle (simulation only)
  previewLogged = true;

  front_routes!: Routes;
  front_routes_production!: Routes;
  menus: MenuStructure = [];
  pages: Page[] = [];
  selected_page: Page | null = null;
  // navbarEntries: ordered list of top-level MenuGroup

  navItemForm: FormGroup = new FormGroup({});
  sandbox_mode: boolean = false;
  hasSandboxNavitems: boolean = false;
  sandboxCount: number = 0;
  productionCount: number = 0;
  showDebugInfo: boolean = false;
  isProcessing: boolean = false;

  private offRef: NgbOffcanvasRef | null = null;
  // Special label tokens recognized by the navbar label_transformer
  SPECIAL_LABELS: string[] = Object.values(LABEL_TRANSFORMERS) as string[];
  currentLabelToken: string = '';
  private slugManuallyEdited = false; // becomes true if user changes slug away from auto-generated value
  private lastAutoSlug = '';
  private skipNextPathUpdate = false; // skip first recompute when opening the editor to avoid duplicate slug in path
  private readonly destroyed$ = new Subject<void>();
  // (helpers and DnD handlers simplified)

  // Getter to retrieve plugin param for the currently selected plugin
  get currentPluginParam(): PluginParamDef | null {
    const pluginName = this.navItemForm?.get('plugin_name')?.value;
    if (!pluginName) return null;
    const meta = PLUGINS_META[pluginName];
    return meta?.param || null;
  }


  constructor(
    private navitemService: NavItemsService,
    private fb: FormBuilder,
    private pageService: PageService,
    private toastService: ToastService,
    private offcanvasService: NgbOffcanvas,
    private cdr: ChangeDetectorRef,
    @Inject(APP_SANDBOX) sandboxFlag: boolean,
    public sandboxService: SandboxService,
    private dynamicRoutesService: DynamicRoutesService
  ) { this.sandbox_mode = sandboxFlag; }

  // Keep a reference to the navbar container to scope DOM queries when possible
  @ViewChild('navbarNav', { static: false, read: ElementRef }) navbarNavRef?: ElementRef;


  ngOnInit(): void {
    this.initialise_form();

    // Load navitems, pages, and snippets together, then enrich once
    // IMPORTANT: first() ensures this runs only once at init, avoiding re-triggering
    // confirm dialogs when pages/snippets are updated elsewhere (e.g., cms-wrapper)
    combineLatest([
      this.navitemService.loadNavItemsSandbox(),
      this.navitemService.loadNavItemsProduction(),
      this.pageService.listPages(),
    ]).pipe(first())
      .subscribe({
        next: async ([sandboxItems, productionItems, pages]) => {
          this.pages = pages.filter(p => p.title !== CLIPBOARD_TITLE).sort((a, b) => a.title.localeCompare(b.title));
          this.hasSandboxNavitems = sandboxItems.length > 0;
          this.sandboxCount = sandboxItems.length;
          this.productionCount = productionItems.length;

          // Forcer Angular à détecter les changements
          this.cdr.detectChanges();

          // Attendre le prochain cycle pour permettre au DOM de se mettre à jour
          // avant d'afficher les prompts bloquants
          await new Promise(resolve => setTimeout(resolve, 0));

          // Gestion de l'initialisation automatique de la sandbox
          if (sandboxItems.length === 0 && productionItems.length > 0) {
            // Sandbox vide : proposer de copier depuis production
            const shouldInit = confirm(
              '📋 La sandbox est vide.\n\n' +
              'Voulez-vous initialiser la sandbox avec la configuration de production actuelle ?\n\n' +
              '(Recommandé pour commencer à éditer les menus)'
            );
            if (shouldInit) {
              try {
                this.isProcessing = true;
                const count = await this.navitemService.cloneProductionToSandbox();
                this.toastService.showSuccess('Menus', `${count} élément(s) copié(s) vers sandbox`);
                // Recharger les données après la copie
                const reloadedSandbox = await firstValueFrom(this.navitemService.loadNavItemsSandbox());
                sandboxItems = reloadedSandbox;
                this.hasSandboxNavitems = sandboxItems.length > 0;
                this.sandboxCount = sandboxItems.length;
                this.sandbox_mode = true;
                this.sandboxService.setSandbox(true);
              } catch (err: any) {
                this.toastService.showErrorToast('Menus', err?.message || 'Échec de l\'initialisation');
              } finally {
                this.isProcessing = false;
              }
            }
          } else if (sandboxItems.length > 0) {
            // Sandbox non vide : proposer de la garder ou de l'écraser
            const choice = confirm(
              '⚠️ Travail en cours détecté dans la sandbox.\n\n' +
              `La sandbox contient ${sandboxItems.length} élément(s).\n` +
              'Voulez-vous CONSERVER ce travail ?\n' +
              'OK = Garder la sandbox actuelle\n' +
              'Annuler = Écraser avec la configuration de production'
            );
            if (!choice && productionItems.length > 0) {
              // L'utilisateur veut écraser avec la production
              try {
                this.isProcessing = true;
                const count = await this.navitemService.cloneProductionToSandbox();
                this.toastService.showSuccess('Menus', `${count} élément(s) copié(s) vers sandbox`);
                // Recharger les données après la copie
                const reloadedSandbox = await firstValueFrom(this.navitemService.loadNavItemsSandbox());
                sandboxItems = reloadedSandbox;
                this.hasSandboxNavitems = sandboxItems.length > 0;
                this.sandboxCount = sandboxItems.length;
              } catch (err: any) {
                this.toastService.showErrorToast('Menus', err?.message || 'Échec de l\'écrasement');
              } finally {
                this.isProcessing = false;
              }
            }
            // Activer automatiquement le mode sandbox si elle n'est pas vide
            this.sandbox_mode = true;
            this.sandboxService.setSandbox(true);
          }

          // Choisir la source selon le mode
          const useSandbox = this.sandbox_mode;
          const navitems = useSandbox ? sandboxItems : productionItems;
          this.navitems = this.enrichWithPageTitleAndCarousel(navitems);
          
          // Générer les routes sandbox
          firstValueFrom(this.navitemService.getFrontRoutes(true)).then(routes => {
            this.front_routes = routes;
          }).catch(err => {
            console.warn('MenusEditor: failed to build preview routes', err);
          });
          // Générer les routes production
          firstValueFrom(this.navitemService.getFrontRoutes(false)).then(routes => {
            this.front_routes_production = routes;
          }).catch(err => {
            console.warn('MenusEditor: failed to build production routes', err);
          });
          // Utiliser la bonne structure de menu
          this.menus = this.buildMenuStructureNew(this.navitems);
          // menu structure loaded
          this.rebuildNavbarEntries();
        },
        error: (err) => this.toastService.showErrorToast('Chargement', err.message)
      });

  }


  

  setSandbox(flag: boolean) {
    this.sandboxService.setSandbox(flag);
    this.sandbox_mode = flag;
    // Dynamic routes are now reloaded globally by app.config via SandboxService.sandbox$
    this.toastService.showSuccess('Sandbox', flag ? 'Mode sandbox activé' : 'Mode normal activé');
    // Reload navitems for new sandbox mode and rebuild menu structure
    this.reloadNavitems();
  }

  label_transformer_simulation(ni: NavItem): string {
    switch (ni.label) {
      case LABEL_TRANSFORMERS.USERNAME:
          return 'John';
      default:
        return ni.label;
    }
  }

  hasMenusForPosition(position: NAVITEM_POSITION): boolean {
    return this.menus.some(m => m.navitem.position === position);
  }

  getLocalIndexForPosition(globalIndex: number, position: NAVITEM_POSITION): number {
    return this.menus.slice(0, globalIndex).filter(m => m.navitem.position === position).length + 1;
  }
  

  private updateComputedPaths() {
    if (this.skipNextPathUpdate) {
      this.skipNextPathUpdate = false;
      return; // leave existing path untouched on initial form patch
    }
    const label = this.navItemForm.get('label')?.value || '';
    const parent_id = this.navItemForm.get('parent_id')?.value || null;
    const segment = (this.navItemForm.get('slug')?.value as string) || charsanitize(label);
    // Compute full path and update preview control
    const full = buildFullPath(segment, parent_id, this.navitems);
    this.navItemForm.get('path')?.setValue(full, { emitEvent: false });
  }

  createNavItem(position: NAVITEM_POSITION = NAVITEM_POSITION.NAVBAR) {
    this.editNavitem(undefined, position);
  }

  editNavitem(navItem?: any, defaultPosition?: NAVITEM_POSITION): void {
    if (navItem) {
      this.selectedNavitem = { ...navItem };
    } else {
      this.selectedNavitem = {
        id: '',
        sandbox: true,
        type: NAVITEM_TYPE.DROPDOWN,
        label: '',
        slug: '',
        path: '',
        rank: 0,
        logging_criteria: NAVITEM_LOGGING_CRITERIA.ANY,
        group_level: 0,
        position: defaultPosition || NAVITEM_POSITION.NAVBAR,
        pre_label: null
      };
    }
    // Patcher le formulaire avec la sélection
  const segment = extractSegment(this.selectedNavitem!, this.navitems);
    
    // Force type change if FOOTER position with DROPDOWN type (not allowed)
    let itemType = this.selectedNavitem!.type;
    if (this.selectedNavitem!.position === NAVITEM_POSITION.FOOTER && itemType === NAVITEM_TYPE.DROPDOWN) {
      itemType = NAVITEM_TYPE.CUSTOM_PAGE;
    }
    
    this.navItemForm.reset({
      type: itemType,
      label: this.selectedNavitem!.label || '',
      slug: segment,
      path: this.selectedNavitem!.path || '',
      position: this.selectedNavitem!.position || NAVITEM_POSITION.NAVBAR,
      logging_criteria: this.selectedNavitem!.logging_criteria || NAVITEM_LOGGING_CRITERIA.ANY,
      parent_id: this.selectedNavitem!.parent_id || null,
      page_id: this.selectedNavitem!.page_id || null,
      extra_parameter: this.selectedNavitem!.extra_parameter || null,
      extra_parameter_label: this.selectedNavitem!.extra_parameter_label || null,
      plugin_name: this.selectedNavitem!.plugin_name || null,
      command_name: this.selectedNavitem!.type === NAVITEM_TYPE.DIRECT_CALL
        ? (Object.values(NAVITEM_COMMAND).includes(this.selectedNavitem!.slug as NAVITEM_COMMAND)
          ? (this.selectedNavitem!.slug as NAVITEM_COMMAND)
          : NAVITEM_COMMAND.SIGN_OUT)
        : null,
    });
    // Initialize special label selector state
    const lbl = this.selectedNavitem!.label || '';
    this.currentLabelToken = this.SPECIAL_LABELS.includes(lbl) ? lbl : '';
    this.configureLabelControlByToken(this.currentLabelToken);
    // Reset auto-slug tracking depending on existing slug
  this.lastAutoSlug = charsanitize(this.navItemForm.get('label')?.value || '');
    this.slugManuallyEdited = segment !== '' && segment !== this.lastAutoSlug;
    // Prevent first recompute from appending slug again
    this.skipNextPathUpdate = true;
    this.updateComputedPaths();
    this.offRef = this.offcanvasService.open(this.editNavitemOffcanvas, { position: 'end' });
  }

  useSpecialLabel(token: string) {
    this.currentLabelToken = token || '';
    this.configureLabelControlByToken(this.currentLabelToken);
  }

  private configureLabelControlByToken(token: string) {
    const labelCtrl = this.navItemForm.get('label') as FormControl;
    if (!labelCtrl) return;
    if (token && this.SPECIAL_LABELS.includes(token)) {
      // Apply token value, disable input, no validators
      labelCtrl.setValue(token, { emitEvent: true });
      labelCtrl.clearValidators();
      labelCtrl.disable({ emitEvent: false });
    } else {
      // Free label: enable input and require it
      labelCtrl.enable({ emitEvent: false });
      labelCtrl.setValidators([Validators.required]);
    }
    labelCtrl.updateValueAndValidity({ emitEvent: false });
  }

  saveNavitem() {
    if (!this.selectedNavitem) return;
    const payload = this.buildPayloadFromForm();
    // Correction : prendre extra_parameter depuis le formulaire si EXTERNAL_REDIRECT
    if (payload.type === NAVITEM_TYPE.EXTERNAL_REDIRECT) {
      payload.extra_parameter = this.navItemForm.get('extra_parameter')?.value || '';
      payload.extra_parameter_label = 'external_url'; // Fixed label for external redirects
    }

    // Guard: prevent second-level items from being DROPDOWN (no dropdowns inside dropdowns)
    if (payload.parent_id && payload.type === NAVITEM_TYPE.DROPDOWN) {
      this.toastService.showErrorToast('Menus', 'Un sous-menu ne peut pas être de type DROPDOWN.');
      return;
    }

    // Enforce unique path only for items that produce routes
    const routeTypes = new Set([NAVITEM_TYPE.INTERNAL_LINK, NAVITEM_TYPE.PLUGIN, NAVITEM_TYPE.CUSTOM_PAGE]);
    if (routeTypes.has(payload.type)) {
      const hasDuplicatePath = this.navitems.some(n => n.path === payload.path && n.id !== payload.id);
      if (hasDuplicatePath) {
        this.toastService.showErrorToast('Menus', 'Ce path est déjà utilisé par un autre élément.');
        return;
      }
    }

    const op = payload.id ? this.navitemService.updateNavItem(payload) : this.navitemService.createNavItem(payload);
    
    op.then(() => {
      this.toastService.showSuccess('Paramètres menu', 'nav_item sauvegardé');
      this.selectedNavitem = null;
      this.offRef?.dismiss('saved');
      this.offRef = null;
      // Refresh list to show updated page_title
      this.reloadNavitems();
    }).catch(err => {
      this.toastService.showErrorToast('Gestion des menus', err.message);
    });
  }

  deleteNavitem(selectedNavitem: NavItem) {
    this.navitemService.deleteNavItem(selectedNavitem).then(() => {
      this.toastService.showSuccess('Paramètres menu', 'nav_item supprimé');
      this.offRef?.dismiss('deleted');
      this.offRef = null;
    });
  }

  async cloneProductionToSandbox() {
    // Ne demander confirmation que si la sandbox contient déjà des éléments
    if (this.hasSandboxNavitems && !confirm('Copier tous les menus de production vers sandbox ? Cela remplacera les menus sandbox existants.')) return;
    this.isProcessing = true;
    try {
      const count = await this.navitemService.cloneProductionToSandbox();
      // Switch to sandbox mode to see the cloned items
      this.setSandbox(true);
      this.toastService.showSuccess('Menus', `${count} élément(s) copié(s) vers sandbox`);
      this.reloadNavitems();
    } catch (err: any) {
      this.toastService.showErrorToast('Menus', err?.message || 'Échec de la copie');
    } finally {
      this.isProcessing = false;
    }
  }

  async promoteSandboxToProduction() {
    // Validate that a BRAND navitem exists before promotion
    const brandExists = this.navitems?.some(item => item.position === NAVITEM_POSITION.BRAND);
    if (!brandExists) {
      const createBrand = confirm(
        '⚠️ ATTENTION: Aucun élément BRAND (navbar-brand) n\'est défini dans les menus sandbox.\n\n' +
        'Sans élément BRAND, la navigation de la barre de navigation ne fonctionnera pas correctement.\n\n' +
        'Voulez-vous continuer quand même la promotion ?'
      );
      if (!createBrand) return;
    }
    
    if (!confirm('Promouvoir tous les menus sandbox vers production ? Cela remplacera tous les menus de production.')) return;
    this.isProcessing = true;
    try {
      const count = await this.navitemService.promoteSandboxToProduction();
      this.toastService.showSuccess('Menus', `${count} élément(s) promu(s) vers production`);
      // After promotion, reload (sandbox is now empty, switch back to production mode)
      this.sandboxService.setSandbox(false);
      this.reloadNavitems();
    } catch (err: any) {
      this.toastService.showErrorToast('Menus', err?.message || 'Échec de la promotion');
    } finally {
      this.isProcessing = false;
    }
  }

  async deleteSandbox() {
    if (!confirm(
      '⚠️ ATTENTION : Vous allez supprimer tous les menus de la sandbox.\n\n' +
      'Cette action abandonnera tout le travail en cours non promu.\n\n' +
      'Voulez-vous vraiment continuer ?'
    )) return;
    
    this.isProcessing = true;
    try {
      // Utiliser le service pour supprimer tous les navitems sandbox
      const sandboxItems = await firstValueFrom(this.navitemService.loadNavItemsSandbox());
      let deletedCount = 0;
      for (const item of sandboxItems) {
        await this.navitemService.deleteNavItem(item);
        deletedCount++;
      }
      this.toastService.showSuccess('Menus', `${deletedCount} élément(s) supprimé(s) de la sandbox`);
      // Basculer en mode production et recharger
      this.sandboxService.setSandbox(false);
      this.sandbox_mode = false;
      this.reloadNavitems();
    } catch (err: any) {
      this.toastService.showErrorToast('Menus', err?.message || 'Échec de la suppression');
    } finally {
      this.isProcessing = false;
    }
  }


  async promoteSandboxMenus() {
    // Optional confirm to avoid accidental promotions
    if (!confirm('Promouvoir tous les menus sandbox en production ? Cette action déplacera les éléments.')) return;
    try {
      const count = await this.navitemService.promoteSandboxMenus();
      this.toastService.showSuccess('Menus', `${count} élément(s) promu(s) vers la production`);
      // After promotion, reload (now sandbox likely empty)
      this.reloadNavitems();
    } catch (err: any) {
      this.toastService.showErrorToast('Menus', err?.message || 'Échec de la promotion');
    }
  }

  show_page(item: NavItem) {
    // Simulation click handler: update preview text and log
    this.front_route_verbose = `Prévisualisation: ${item.label} (${item.path})`;

    this.selected_page = item.page_id ? this.pages.find(p => p.id === item.page_id) || null : null;
  }


  initialise_form() {
    this.navItemForm = this.fb.group({
      sandbox: new FormControl(true),
      type: new FormControl(NAVITEM_TYPE.DROPDOWN, { validators: [Validators.required] }),
      label: new FormControl('', { validators: [Validators.required] }),
      slug: new FormControl(''),
      path: new FormControl({ value: '', disabled: true }),
      position: new FormControl('', { validators: [Validators.required] }),
      logging_criteria: new FormControl(NAVITEM_LOGGING_CRITERIA.ANY, { validators: [Validators.required] }),
      parent_id: new FormControl<string | null>(null),
      page_id: new FormControl<string | null>(null),
      extra_parameter: new FormControl<string | null>(null),
      extra_parameter_label: new FormControl<string | null>(null),
      plugin_name: new FormControl<string | null>(null),
      pre_label: new FormControl<'icon' | 'avatar' | null>(null),
      command_name: new FormControl<NAVITEM_COMMAND | null>(null),
    });

    // Dynamically require slug (segment) except for Dropdown + enforce allowed characters
    const typeCtrl = this.navItemForm.get('type')!;
    const segCtrlV = this.navItemForm.get('slug')!; // for validators only
    const cmdCtrl = this.navItemForm.get('command_name')!;
    const extraParamCtrl = this.navItemForm.get('extra_parameter')!;
    const applySegmentValidators = (t: NAVITEM_TYPE) => {
      if (t === NAVITEM_TYPE.DROPDOWN || t === NAVITEM_TYPE.DIRECT_CALL) {
        segCtrlV.clearValidators();
      } else {
        segCtrlV.setValidators([Validators.required, Validators.pattern(/^[a-z0-9_]+$/)]);
      }
      segCtrlV.updateValueAndValidity({ emitEvent: false });

      if (t === NAVITEM_TYPE.DIRECT_CALL) {
        cmdCtrl.setValidators([Validators.required]);
      } else {
        cmdCtrl.clearValidators();
        cmdCtrl.setValue(null, { emitEvent: false });
      }
      cmdCtrl.updateValueAndValidity({ emitEvent: false });

      // extra_parameter: required only for EXTERNAL_REDIRECT
      if (t === NAVITEM_TYPE.EXTERNAL_REDIRECT) {
        extraParamCtrl.setValidators([Validators.required]);
      } else {
        extraParamCtrl.clearValidators();
      }
      extraParamCtrl.updateValueAndValidity({ emitEvent: false });
    };

    applySegmentValidators(typeCtrl.value as NAVITEM_TYPE);
    typeCtrl.valueChanges.subscribe((t: NAVITEM_TYPE) => applySegmentValidators(t));

    // Auto-set extra_parameter_label when plugin is selected (from PluginMeta.param.dataKey)
    const pluginNameCtrl = this.navItemForm.get('plugin_name')!;
    const extraParamLabelCtrl = this.navItemForm.get('extra_parameter_label')!;
    pluginNameCtrl.valueChanges.subscribe((pn: NAVITEM_PLUGIN | null) => {
      if (pn) {
        const meta = PLUGINS_META[pn];
        if (meta?.param?.dataKey) {
          extraParamLabelCtrl.setValue(meta.param.dataKey, { emitEvent: false });
        } else {
          extraParamLabelCtrl.setValue(null, { emitEvent: false });
        }
      } else {
        extraParamLabelCtrl.setValue(null, { emitEvent: false });
      }
    });

    // Auto-generate slug & path preview.
    // Strategy: while user has not manually edited slug (slugManuallyEdited=false),
    // keep regenerating slug from label. If user edits slug, stop updating automatically.
    const labelCtrl = this.navItemForm.get('label');
    const parentCtrl = this.navItemForm.get('parent_id');
    const segCtrl = this.navItemForm.get('slug');

    labelCtrl?.valueChanges.subscribe(() => {
      if (!this.slugManuallyEdited) {
        const auto = charsanitize(labelCtrl.value || '');
        this.lastAutoSlug = auto;
        segCtrl?.setValue(auto, { emitEvent: false });
      }
      this.updateComputedPaths();
    });
    parentCtrl?.valueChanges.subscribe(() => this.updateComputedPaths());

    segCtrl?.valueChanges.subscribe((v) => {
      if (typeof v === 'string') {
        const sanitized = charsanitize(v);
        if (sanitized !== v) {
          segCtrl.setValue(sanitized, { emitEvent: false });
          v = sanitized;
        }
        // Detect manual edit: differs from last auto slug
        this.slugManuallyEdited = (this.lastAutoSlug !== '' && v !== this.lastAutoSlug);
      }
      this.updateComputedPaths();
    });

    // Keep slug/path in sync for DirectCall command
    cmdCtrl.valueChanges.subscribe((cmd: NAVITEM_COMMAND | null) => {
      if (typeCtrl.value === NAVITEM_TYPE.DIRECT_CALL) {
        const key = (cmd || NAVITEM_COMMAND.SIGN_OUT).toString();
        this.navItemForm.get('slug')?.setValue(key, { emitEvent: false });
        this.navItemForm.get('path')?.setValue('', { emitEvent: false });
      }
    });
  }

  private enrichWithPageTitleAndCarousel(items: NavItem[]): NavItem[] {
    if (!this.pages || this.pages.length === 0) return items;
    const byId = new Map(this.pages.map(p => [p.id, { title: p.title, carousel: p.template === PAGE_TEMPLATES.ALBUMS }] as [string, { title: string, carousel: boolean }]));
    const enriched = items.map(n => (
      n.page_id ? { ...n, page_title: byId.get(n.page_id)?.title, carousel: byId.get(n.page_id)?.carousel } : n
    ));
    return enriched;
  }

  // Build a local menu structure from the enriched navitems list
  // Nouvelle version récursive pour MenuStructure
  private buildMenuStructureNew(items: NavItem[], parentId: string | null = null): MenuGroup[] {
    // Filtrer les navitems du niveau courant
    const levelItems = items.filter(it => it.parent_id === parentId);
    // Trier par rank
    levelItems.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    // Construire récursivement
    return levelItems.map(it => ({
      navitem: it,
      childs: this.buildMenuStructureNew(items, it.id)
    }));
  }

  private reloadNavitems() {
    combineLatest([
      this.navitemService.loadNavItemsSandbox(),
      this.navitemService.loadNavItemsProduction(),
      this.pageService.listPages()
    ]).pipe(first())
      .subscribe(([sandboxItems, productionItems, pages]) => {
        this.pages = pages;
        // Choisir la source selon le mode
        const useSandbox = this.sandbox_mode;
        const navitems = useSandbox ? sandboxItems : productionItems;
        this.navitems = this.enrichWithPageTitleAndCarousel(navitems);
        this.hasSandboxNavitems = sandboxItems.length > 0;
        this.sandboxCount = sandboxItems.length;
        this.productionCount = productionItems.length;
        this.menus = this.buildMenuStructureNew(this.navitems);
        // Générer les routes sandbox
        firstValueFrom(this.navitemService.getFrontRoutes(true)).then(routes => {
          this.front_routes = routes;
          try {
            if (this.sandboxService && this.sandboxService.value) {
              this.dynamicRoutesService.setRoutes(this.front_routes);
            }
          } catch (err) {
            // Defensive: don't break editor if dynamic route update fails
          }
        }).catch(err => {
          console.warn('MenusEditor.reloadNavitems: failed to compute front routes', err);
        });
        // Générer les routes production
        firstValueFrom(this.navitemService.getFrontRoutes(false)).then(routes => {
          this.front_routes_production = routes;
        }).catch(err => {
          console.warn('MenusEditor.reloadNavitems: failed to compute production routes', err);
        });
        this.rebuildNavbarEntries();
      });
  }

  private rebuildNavbarEntries() {
    const entries = Object.values(this.menus || {});
    this.navbarEntries = entries
      .filter(e => e.navitem.position === NAVITEM_POSITION.NAVBAR)
      .sort((a, b) => (a.navitem.rank ?? 0) - (b.navitem.rank ?? 0));
    this.rebuildVisibleNavbarEntries();

    this.footbarEntries = entries
      .filter(e => e.navitem.position === NAVITEM_POSITION.FOOTER)
      .sort((a, b) => (a.navitem.rank ?? 0) - (b.navitem.rank ?? 0));
    this.rebuildVisibleFootbarEntries();
  }

  // Maintain a stable visible array used by CDK so it can reflect DOM reorder
  private rebuildVisibleNavbarEntries() {
    this._visibleNavbarEntries = (this.navbarEntries || [])
      .filter(e => this.allow(e.navitem))
      .sort((a, b) => (a.navitem.rank ?? 0) - (b.navitem.rank ?? 0));
  }

  private rebuildVisibleFootbarEntries() {
    this._visibleFootbarEntries = (this.footbarEntries || [])
      .filter(e => this.allow(e.navitem))
      .sort((a, b) => (a.navitem.rank ?? 0) - (b.navitem.rank ?? 0));
  }

  // Return the cached visible array (stable reference)
  get visibleNavbarEntries(): MenuGroup[] {
    return this._visibleNavbarEntries;
  }

  get visibleFootbarEntries(): MenuGroup[] {
    return this._visibleFootbarEntries;
  }

  get brandNavitem(): NavItem | null {
    return this.navitems?.find(item => item.position === NAVITEM_POSITION.BRAND) || null;
  }

  // trackBy for menu items to keep DOM stable during reorders
  trackByNavId(item: MenuGroup) {
    return item?.navitem?.id;
  }

  allow(ni: NavItem): boolean {
    switch (ni.logging_criteria) {
      case NAVITEM_LOGGING_CRITERIA.LOGGED_ONLY:
        return this.previewLogged;
      case NAVITEM_LOGGING_CRITERIA.UNLOGGED_ONLY:
        return !this.previewLogged;
      default:
        return true;
    }
  }

  hasVisibleChildren(entry: MenuGroup): boolean {
    if (entry.navitem.type !== NAVITEM_TYPE.DROPDOWN) return true;
    return (entry.childs ?? []).some(childGroup => this.allow(childGroup.navitem));
  }


  onPreviewToggle(flag: boolean) {
    this.previewLogged = flag;
    this.rebuildVisibleNavbarEntries();
  }

  // Reorder top-level navbar parents and persist their rank (0-based)
  dropParent(event: CdkDragDrop<MenuGroup[]>) {
    if (!event.container || event.previousIndex === event.currentIndex) return;
    // Let CDK animate by rearranging the visible array first
    moveItemInArray(this._visibleNavbarEntries, event.previousIndex, event.currentIndex);
    // Then map the visible array order into the full navbarEntries
    return this.reorderByVisibleFinalOrder();
  }

  // Robust reorder: build the new full navbarEntries ordering from the current visible order
  // This avoids fragile index mapping when the visible array was mutated by CDK animations.
  private async reorderByVisibleFinalOrder() {
    try {
      const visibleIds = (this.visibleNavbarEntries || []).map(v => v.navitem.id);

      // Build new ordered array: first include visible entries in their current order
      const idToEntry = new Map(this.navbarEntries.map(e => [e.navitem.id, e] as [string, MenuGroup]));
      const newOrder: MenuGroup[] = [];

      visibleIds.forEach(id => {
        const entry = idToEntry.get(id);
        if (entry) newOrder.push(entry);
      });

      // Append any entries that are not visible (e.g. filtered out) preserving their existing order
      this.navbarEntries.forEach(e => {
        if (!visibleIds.includes(e.navitem.id)) newOrder.push(e);
      });

      // Replace full list
      this.navbarEntries = newOrder;

      try { this.cdr.detectChanges(); } catch (e) { /* ignore */ }

      // Recompute ranks globally (0-based)
      this.navbarEntries.forEach((entry, idx) => entry.navitem.rank = idx);

      // Persist updated parent ranks
      try {
        await Promise.all(this.navbarEntries.map(e => this.navitemService.updateNavItem(e.navitem)));
        this.toastService.showSuccess('Menus', 'Ordre des menus mis à jour');
        // Ensure visible cache matches persisted order
        this.rebuildVisibleNavbarEntries();
        // Clear any inline transform left by CDK so flexbox can reflow items horizontally
        try { this.clearCdkTransforms(); } catch (e) { /* ignore */ }
      } catch (err) {
        this.toastService.showErrorToast('Menus', 'Échec mise à jour de l\'ordre');
        this.reloadNavitems();
      }
    } catch (e) {
      // defensive
      this.reloadNavitems();
    }
  }


  // Remove inline transform/transition styles CDK may have applied to elements during drag.
  // When a transform remains, flex layout can't reposition items correctly after DOM reorder.
  private clearCdkTransforms() {
    try {
      const rootEl = this.navDropListRef && this.navDropListRef.nativeElement ? this.navDropListRef.nativeElement as HTMLElement : null;
      if (!rootEl) return;

      // Reset inline transforms/transitions on draggable elements inside the nav drop list
      const draggables = Array.from(rootEl.querySelectorAll('.cdk-drag')) as HTMLElement[];
      draggables.forEach(d => {
        d.style.transform = '';
        d.style.transition = '';
      });

      // Clean previews/placeholders only inside the nav drop list (do not touch the whole document)
      const previews = Array.from(rootEl.querySelectorAll('.cdk-drag-preview, .cdk-drag-placeholder')) as HTMLElement[];
      previews.forEach(p => {
        try {
          // Prefer clearing inline styles rather than removing DOM nodes
          p.style.transform = '';
          p.style.left = '';
          p.style.top = '';
          p.style.transition = '';
          p.style.pointerEvents = 'none';
        } catch (e) {
          // ignore
        }
      });

      try { this.cdr.detectChanges(); } catch (e) { /* ignore */ }
    } catch (e) {
      // silent
    }
  }

  // Drag handlers (move/end) — kept minimal
  onDragMoved() {
    try {
      /* minimal log to avoid spamming */
    } catch (e) { /* silent */ }
    // No-op: kept intentionally minimal to avoid interfering with CDK preview lifecycle
  }

  // Close any open dropdowns when drag starts so menus don't remain open
  onDragStarted(event: CdkDragStart) {
    try {
      const originEl = (event && (event.source as any) && (event.source as any).element && (event.source as any).element.nativeElement)
        ? (event.source as any).element.nativeElement as HTMLElement
        : null;

      // Find parent dropdown element that contains the dragged element (if any)
      const originDropdownEl = originEl ? originEl.closest('.dropdown') as HTMLElement | null : null;

      // Scope root for queries
      const rootEl = this.navbarNavRef && this.navbarNavRef.nativeElement ? this.navbarNavRef.nativeElement as HTMLElement : document;

      // If we couldn't find the origin dropdown, avoid closing any dropdowns here
      if (!originDropdownEl) return;

      // Close all dropdowns except the one that contains the drag origin
      const dropdownEls = Array.from(rootEl.querySelectorAll('.dropdown')) as HTMLElement[];
      dropdownEls.forEach(el => {
        if (originDropdownEl && originDropdownEl.isSameNode(el)) return; // keep origin open
        // remove visual open state
        el.classList.remove('show');
        const menu = el.querySelector('.dropdown-menu');
        if (menu) menu.classList.remove('show');
        // set toggle aria-expanded to false
        const toggle = el.querySelector('.dropdown-toggle') as HTMLElement | null;
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      });

      // Also attempt to call NgbDropdown.close() on known instances except origin
      try {
        this.dropdowns?.forEach(d => {
          try {
            const dEl = (d as any)._elementRef?.nativeElement as HTMLElement | undefined;
            if (dEl && originDropdownEl && dEl.isSameNode(originDropdownEl)) return;
            try { d.close(); } catch (e) { /* ignore */ }
          } catch (e) { /* ignore */ }
        });
      } catch (e) { /* ignore */ }
    } catch (e) { /* silent */ }
  }


  // Preview positioning is handled via CSS and `clearCdkTransforms`
  async onDragEnded() {
    try {
      // Simplified: rely on CDK drop event handling to persist order.
      try { this.clearCdkTransforms(); } catch (e) { /* ignore */ }
    } catch (e) { /* silent */ }
  }

  // Wrapper invoked from template to timestamp and forward the drop event.
  // This helps confirm whether the `(cdkDropListDropped)` event reaches the component.
  onParentDrop(event: CdkDragDrop<MenuGroup[]>) {
    try {
      // parent drop forwarded to reorder + persist
      this.dropParent(event);
    } catch (e) {
      // silent
    }
  }

  // Handler for drops inside a parent's child list (sub-menu ordering)
  async onChildDrop(event: CdkDragDrop<any>, parent: MenuGroup) {
    try {
      if (!event.container) return;
      // Only handle reorders within the same child list. Ignore cross-container transfers.
      if (event.previousContainer !== event.container) return;
      if (!parent.childs) parent.childs = [];
      if (event.previousIndex === event.currentIndex) return;

      moveItemInArray(parent.childs, event.previousIndex, event.currentIndex);

      parent.childs.forEach((c, idx) => c.navitem.rank = idx);

      try {
        await Promise.all(parent.childs.map(c => this.navitemService.updateNavItem(c.navitem)));
        this.toastService.showSuccess('Menus', 'Ordre des sous-menus mis à jour');
        this.reloadNavitems();
      } catch (err) {
        // Ajout log détaillé pour diagnostic
        let msg = "Échec mise à jour de l'ordre des sous-menus";
        const e: any = err;
        // Affiche tout l'objet erreur pour diagnostic maximal
        msg += `\n${JSON.stringify(e)}`;
        this.toastService.showErrorToast('Menus', msg);
        // Log complet en console
        console.error('Erreur updateNavItem (DnD footbar)', err);
        this.reloadNavitems();
      }
    } catch (e) {
      // non-fatal
    }
  }

  // Allow items into a child list only if they already belong to that parent (no cross-drop)
  childEnterPredicate = (drag: any, drop: any): boolean => {
    try {
      const item = drag?.item?.data as MenuGroup | undefined;
      if (!item || !item.navitem) return false;
      const parentId = drop?.container?.element?.nativeElement?.getAttribute
        ? drop.container.element.nativeElement.getAttribute('data-parent-id')
        : null;
      return !!(parentId && item.navitem.parent_id === parentId);
    } catch (e) {
      return false;
    }
  }


  private buildPayloadFromForm(): NavItem {
    interface NavItemFormValue {
      sandbox: boolean;
      type: NAVITEM_TYPE;
      label: string;
      slug: string;
      path: string;
      logging_criteria: NAVITEM_LOGGING_CRITERIA;
      position: NAVITEM_POSITION;
      parent_id: string | null;
      page_id: string | null;
      extra_parameter: string | null;
      extra_parameter_label: string | null;
      plugin_name: NAVITEM_PLUGIN | null;
      pre_label: 'icon' | 'avatar' | null;
    }
    const formValue = this.navItemForm.getRawValue() as NavItemFormValue;
    // Guard against selecting self as parent
    if (formValue.parent_id && this.selectedNavitem?.id && formValue.parent_id === this.selectedNavitem.id) {
      this.toastService.showErrorToast('Menus', 'Un élément ne peut pas être son propre parent');
      throw new Error('Invalid parent selection: self-parent');
    }
    const isDirectCall = formValue.type === NAVITEM_TYPE.DIRECT_CALL;
    const segment = isDirectCall ? (formValue.slug || 'signout') : (formValue.slug || charsanitize(formValue.label || ''));
    const fullPath = isDirectCall ? '' : buildFullPath(segment, formValue.parent_id, this.navitems);
    const page_title = formValue.page_id ? this.pages.find(p => p.id === formValue.page_id)?.title : undefined;
    return {
      id: this.selectedNavitem?.id || '',
      sandbox: this.selectedNavitem?.sandbox ?? true, // Preserve existing sandbox flag, default to true for new items
      type: formValue.type,
      label: formValue.label,
      logging_criteria: formValue.logging_criteria,
      slug: segment,
      path: fullPath,
      position: formValue.position,
      pre_label: formValue.pre_label,
      parent_id: formValue.parent_id || undefined,
      page_id: isDirectCall ? undefined : (formValue.page_id || undefined),
      page_title,
      extra_parameter: isDirectCall ? undefined : (formValue.extra_parameter || undefined),
      extra_parameter_label: isDirectCall ? undefined : (formValue.extra_parameter_label || undefined),
      plugin_name: isDirectCall ? undefined : (formValue.plugin_name || undefined),
      rank: this.selectedNavitem?.rank ?? 0,
      group_level: this.selectedNavitem?.group_level ?? 0,
    } as NavItem;
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  ngAfterViewInit(): void {
    // Close any NgbDropdown instances that might be open at startup
    try {
      // run in a timeout to let Angular finish rendering children
      setTimeout(() => {
        try {
          this.dropdowns?.forEach(d => {
            try { d.close(); } catch (e) { /* ignore */ }
          });

          // Also remove any leftover `.show` classes on dropdown menus inside the navbar
          const rootEl = this.navbarNavRef && this.navbarNavRef.nativeElement ? this.navbarNavRef.nativeElement as HTMLElement : document;
          const shown = Array.from(rootEl.querySelectorAll('.dropdown-menu.show')) as HTMLElement[];
          shown.forEach(el => el.classList.remove('show'));
          const shownParents = Array.from(rootEl.querySelectorAll('.dropdown.show')) as HTMLElement[];
          shownParents.forEach(el => el.classList.remove('show'));

          // Also ensure any dropdown toggles report aria-expanded=false
          const toggles = Array.from(rootEl.querySelectorAll('.dropdown-toggle')) as HTMLElement[];
          toggles.forEach(t => {
            try {
              t.setAttribute('aria-expanded', 'false');
            } catch (e) { /* ignore */ }
          });
        } catch (e) {
          // ignore
        }
      }, 0);
    } catch (e) {
      // ignore
    }
  }

  // async createPage(): Promise<void> {
  //   const newPage: Page = {
  //     id: 'page_' + Date.now(),
  //     title: 'Nouvelle page',
  //     template: PAGE_TEMPLATES.PUBLICATION,
  //     snippet_ids: []
  //   };
  //   try {
  //     const created = await this.pageService.createPage(newPage);
  //     this.pages.push(created);
  //     this.selectedPageId = created.id;
  //     this.toastService.showSuccess('Pages', 'Nouvelle page créée');
  //     this.cdr.detectChanges();
  //   } catch (error) {
  //     this.toastService.showErrorToast('Pages', 'Erreur lors de la création de la page');
  //   }
  // }
}