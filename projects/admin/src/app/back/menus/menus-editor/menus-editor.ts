import { Component, ViewChild, Inject, ChangeDetectorRef, ElementRef } from '@angular/core';
import { NgbOffcanvas, NgbOffcanvasRef } from '@ng-bootstrap/ng-bootstrap';
import { ToastService } from '../../../common/services/toast.service';
import { NavItemsService } from '../../../common/services/navitem.service';
import { MenuStructure, MenuGroup, NavItem, NAVITEM_LOGGING_CRITERIA, NAVITEM_POSITION, NAVITEM_TYPE } from '../../../common/interfaces/navitem.interface';
import { NAVITEM_COMMAND } from '../../../common/interfaces/plugin.interface';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Routes } from '@angular/router';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { NAVITEM_PLUGIN } from '../../../common/interfaces/plugin.interface';
import { LABEL_TRANSFORMERS } from '../../../common/interfaces/plugin.interface';
import { PageService } from '../../../common/services/page.service';
import { Page } from '../../../common/interfaces/page_snippet.interface';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CdkDragDrop, moveItemInArray, CdkDragStart, CdkDragMove, CdkDragEnd } from '@angular/cdk/drag-drop';
import { APP_SANDBOX } from '../../../app.config';
import { SandboxService } from '../../../common/services/sandbox.service';
import { DynamicRoutesService } from '../../../common/services/dynamic-routes.service';
import { Subject, combineLatest } from 'rxjs';
import { charsanitize, buildFullPath, extractSegment } from '../../../common/utils/navitem.utils';
// Preview in editor will always be generated from sandbox navitems; no need for static front routes here
// import { path } from 'd3';

@Component({
  selector: 'app-menus-editor',
  templateUrl: './menus-editor.html',
  styleUrls: ['./menus-editor.scss'],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbDropdownModule, DragDropModule]
})
export class MenusEditorComponent  {
  // ... autres propriétés ...
  navbarEntries: MenuGroup[] = [];
  private _visibleNavbarEntries: MenuGroup[] = [];
  @ViewChild('editNavitemOffcanvas', { static: true }) editNavitemOffcanvas: any;
  @ViewChild('navDropList', { static: false, read: ElementRef }) navDropListRef?: ElementRef;

  selectedNavitem: NavItem | null = null;
  navitems!: NavItem[];
  NAVITEM_TYPE = NAVITEM_TYPE;
  NAVITEM_TYPES = Object.values(NAVITEM_TYPE);
  NAVITEM_POSITION = NAVITEM_POSITION;
  NAVITEM_POSITIONS = Object.values(NAVITEM_POSITION);
  NAVITEM_PLUGIN = NAVITEM_PLUGIN;
  NAVITEM_PLUGINS = Object.values(NAVITEM_PLUGIN);
  NAVITEM_LOGGING_CRITERIA = NAVITEM_LOGGING_CRITERIA;
  NAVITEM_LOGGING_CRITERIA_VALUES = Object.values(NAVITEM_LOGGING_CRITERIA);
  NAVITEM_COMMAND = NAVITEM_COMMAND;
  NAVITEM_COMMANDS = Object.values(NAVITEM_COMMAND);

  front_route_verbose = '';
  // Preview auth state toggle (simulation only)
  previewLogged = false;

  front_routes!: Routes;
  // legacy: navItems unused
  menus: MenuStructure = [];
  pages: Page[] = [];
  selected_page: Page | null = null;
  // Ordered list for NAVBAR parents used for DnD at parent level
  // navbarEntries est maintenant de type MenuGroup[]

  navItemForm: FormGroup = new FormGroup({});
  routes!: Routes;
  sandbox_mode: boolean = false;

  private offRef: NgbOffcanvasRef | null = null;
  // Special label tokens recognized by the navbar label_transformer
  SPECIAL_LABELS: string[] = Object.values(LABEL_TRANSFORMERS) as string[];
  currentLabelToken: string = '';
  private slugManuallyEdited = false; // becomes true if user changes slug away from auto-generated value
  private lastAutoSlug = '';
  private skipNextPathUpdate = false; // skip first recompute when opening the editor to avoid duplicate slug in path
  private readonly destroyed$ = new Subject<void>();
  // Sorting helper for keyvalue pipe to sort parents by rank
  compareMenuEntries = (a: any, b: any) => (a?.value?.parent?.rank ?? 0) - (b?.value?.parent?.rank ?? 0);
  // Drag&Drop: handler for reordering top-level navbar entries
  private lastDragPrevIndex: number | null = null;
  private lastPointerPosition: { x: number; y: number } | null = null;
  private lastDropHandled: boolean = false;



  constructor(
    private navitemService: NavItemsService,
    private fb: FormBuilder,
    private pageService: PageService,
    private toastService: ToastService,
    private offcanvasService: NgbOffcanvas,
    private cdr: ChangeDetectorRef,
    @Inject(APP_SANDBOX) sandboxFlag: boolean,
    public sandboxService: SandboxService,
    private dynamicRoutesService: DynamicRoutesService,
  ) { this.sandbox_mode = sandboxFlag; }

  // NOTE: we keep a reference to the navbar container to scope DOM queries when possible
  @ViewChild('navbarNav', { static: false, read: ElementRef }) navbarNavRef?: ElementRef;


  ngOnInit(): void {
    this.initialise_form();

    // Load navitems and pages together, then enrich once
    combineLatest([
      this.navitemService.loadNavItemsSandbox(),
      this.pageService.listPages()
    ])
      .subscribe({
        next: ([navitems, pages]) => {
          this.pages = pages;
          this.navitems = this.enrichWithPageTitle(navitems);
          // Editor preview always reflects sandbox dataset
          this.front_routes = this.navitemService.generateFrontRoutes(this.navitems);
          this.menus = this.buildMenuStructureNew(this.navitems);
          // menu structure loaded
          this.rebuildNavbarEntries();
        },
        error: (err) => this.toastService.showErrorToast('Chargement', err.message)
      });

  }


  // Reorder the full navbarEntries using the moved item's id and an anchor id + offset (0 before, 1 after)
  private async reorderByMovedId(movedId: string, anchorId: string | null, insertionOffset: number) {
    try {
      const removedIndex = this.navbarEntries.findIndex(e => e.navitem.id === movedId);
        if (removedIndex === -1) {
        return;
      }
      const [moved] = this.navbarEntries.splice(removedIndex, 1);

      let insertIndex: number;
      if (anchorId) {
        const anchorIndex = this.navbarEntries.findIndex(e => e.navitem.id === anchorId);
        insertIndex = anchorIndex === -1 ? this.navbarEntries.length : (anchorIndex + insertionOffset);
      } else {
        insertIndex = this.navbarEntries.length;
      }

      // clamp
      insertIndex = Math.max(0, Math.min(this.navbarEntries.length, insertIndex));

      this.navbarEntries.splice(insertIndex, 0, moved);

      try { this.cdr.detectChanges(); } catch (e) { /* ignore */ }

      // Recompute ranks
      this.navbarEntries.forEach((entry, idx) => entry.navitem.rank = idx);

      // Persist
      try {
        await Promise.all(this.navbarEntries.map(e => this.navitemService.updateNavItem(e.navitem)));
        this.toastService.showSuccess('Menus', 'Ordre des menus mis à jour');
        this.rebuildVisibleNavbarEntries();
        try { this.clearCdkTransforms(); } catch (e) { /* ignore */ }
      } catch (err) {
        this.toastService.showErrorToast('Menus', 'Échec mise à jour de l\'ordre');
        this.reloadNavitems();
      }
    } catch (e) {
      this.reloadNavitems();
    }
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

  createNavItem() {
    this.editNavitem();
  }

  editNavitem(navItem?: any): void {
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
        position: NAVITEM_POSITION.NAVBAR,
        pre_label: null
      };
    }
    // Patcher le formulaire avec la sélection
  const segment = extractSegment(this.selectedNavitem!, this.navitems);
    this.navItemForm.reset({
      type: this.selectedNavitem!.type,
      label: this.selectedNavitem!.label || '',
      slug: segment,
      path: this.selectedNavitem!.path || '',
      position: this.selectedNavitem!.position || NAVITEM_POSITION.NAVBAR,
      logging_criteria: this.selectedNavitem!.logging_criteria || NAVITEM_LOGGING_CRITERIA.ANY,
      parent_id: this.selectedNavitem!.parent_id || null,
      page_id: this.selectedNavitem!.page_id || null,
      external_url: this.selectedNavitem!.external_url || null,
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
    // Correction : prendre external_url depuis le formulaire si EXTERNAL_REDIRECT
    if (payload.type === NAVITEM_TYPE.EXTERNAL_REDIRECT) {
      payload.external_url = this.navItemForm.get('external_url')?.value || '';
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
    op.then((res) => {
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
    // Logique pour supprimer le nav item
    this.navitemService.deleteNavItem(selectedNavitem).then(() => {
      this.toastService.showSuccess('Paramètres menu', 'nav_item supprimé');
      this.offRef?.dismiss('deleted');
      this.offRef = null;
    });
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
  // Drag&Drop handlers removed: this preview no longer exposes DnD interactions



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
      external_url: new FormControl<string | null>(null),
      plugin_name: new FormControl<string | null>(null),
      pre_label: new FormControl<'icon' | 'avatar' | null>(null),
      command_name: new FormControl<NAVITEM_COMMAND | null>(null),
    });

    // Dynamically require slug (segment) except for Dropdown + enforce allowed characters
    const typeCtrl = this.navItemForm.get('type')!;
    const segCtrlV = this.navItemForm.get('slug')!; // for validators only
    const pathCtrl = this.navItemForm.get('path')!; // read-only preview
    const cmdCtrl = this.navItemForm.get('command_name')!;
    const externalUrlCtrl = this.navItemForm.get('external_url')!;
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

      // external_url: required only for EXTERNAL_REDIRECT
      if (t === NAVITEM_TYPE.EXTERNAL_REDIRECT) {
        externalUrlCtrl.setValidators([Validators.required]);
      } else {
        externalUrlCtrl.clearValidators();
        externalUrlCtrl.setValue(null, { emitEvent: false });
      }
      externalUrlCtrl.updateValueAndValidity({ emitEvent: false });
    };

    applySegmentValidators(typeCtrl.value as NAVITEM_TYPE);
    typeCtrl.valueChanges.subscribe((t: NAVITEM_TYPE) => applySegmentValidators(t));

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

  private enrichWithPageTitle(items: NavItem[]): NavItem[] {
    if (!this.pages || this.pages.length === 0) return items;
    const byId = new Map(this.pages.map(p => [p.id, p.title] as [string, string]));
    return items.map(n => (n.page_id ? { ...n, page_title: byId.get(n.page_id) } : n));
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
      this.pageService.listPages()
    ])
      .subscribe(([navitems, pages]) => {
        this.pages = pages;
        this.navitems = this.enrichWithPageTitle(navitems);
  this.menus = this.buildMenuStructureNew(this.navitems);
        // Preview always built from sandbox items
        this.front_routes = this.navitemService.generateFrontRoutes(this.navitems);
        // If sandbox mode is active, update global dynamic routes so the front preview/router picks changes
        try {
          if (this.sandboxService && this.sandboxService.value) {
            this.dynamicRoutesService.setRoutes(this.front_routes);
          }
        } catch (err) {
          // Defensive: don't break editor if dynamic route update fails
        }
        this.rebuildNavbarEntries();
      });
  }

  private rebuildNavbarEntries() {
    const entries = Object.values(this.menus || {});
    this.navbarEntries = entries
      .filter(e => e.navitem.position === NAVITEM_POSITION.NAVBAR)
      .sort((a, b) => (a.navitem.rank ?? 0) - (b.navitem.rank ?? 0));
    this.rebuildVisibleNavbarEntries();
  }

  // Maintain a stable visible array used by CDK so it can reflect DOM reorder
  private rebuildVisibleNavbarEntries() {
    this._visibleNavbarEntries = (this.navbarEntries || [])
      .filter(e => this.allow(e.navitem))
      .sort((a, b) => (a.navitem.rank ?? 0) - (b.navitem.rank ?? 0));
  }

  // Return the cached visible array (stable reference)
  get visibleNavbarEntries(): MenuGroup[] {
    return this._visibleNavbarEntries;
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
  }

  // Reorder top-level navbar parents and persist their rank (0-based)
  dropParent(event: CdkDragDrop<MenuGroup[]>) {
    if (!event.container || event.previousIndex === event.currentIndex) return;
    // Let CDK animate by rearranging the visible array first
    moveItemInArray(this._visibleNavbarEntries, event.previousIndex, event.currentIndex);
    // Then map the visible array order into the full navbarEntries
    this.lastDropHandled = true;
    return this.reorderByVisibleIndices(event.previousIndex, event.currentIndex);
  }

  private async reorderByVisibleIndices(prevVisibleIndex: number, newVisibleIndex: number) {
    // Work with the visible subset to map visible indices to the full navbarEntries
    const visible = this.visibleNavbarEntries;
    const prevVisible = visible[prevVisibleIndex];
    // currentIndex can be equal to visible.length when dropping at the end
    const currVisible = newVisibleIndex < visible.length ? visible[newVisibleIndex] : null;
    if (!prevVisible) {
      return;
    }

    // Remove from full array
    const removedIndex = this.navbarEntries.findIndex(e => e.navitem.id === prevVisible.navitem.id);
    if (removedIndex === -1) {
      return;
    }
    const [moved] = this.navbarEntries.splice(removedIndex, 1);

    // Compute insertion index in full array
    let insertIndex: number;
    if (currVisible) {
      insertIndex = this.navbarEntries.findIndex(e => e.navitem.id === currVisible.navitem.id);
      if (insertIndex === -1) insertIndex = this.navbarEntries.length;
    } else {
      insertIndex = this.navbarEntries.length;
    }

    this.navbarEntries.splice(insertIndex, 0, moved);

    // Force change detection so the rendered list updates immediately
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
  }

  // Remove inline transform/transition styles CDK may have applied to elements during drag.
  // When a transform remains, flex layout can't reposition items correctly after DOM reorder.
  private clearCdkTransforms() {
    try {
      const rootEl: HTMLElement | Document = (this.navDropListRef && this.navDropListRef.nativeElement) ? this.navDropListRef.nativeElement as HTMLElement : document;
      // Reset transforms on draggable elements within scope
      const draggables = Array.from(rootEl.querySelectorAll('.cdk-drag')) as HTMLElement[];
      draggables.forEach(d => {
        d.style.transform = '';
        d.style.transition = '';
      });

      // Remove any preview/placeholder nodes created by CDK to avoid accumulated positional offsets
      const previews = Array.from(document.querySelectorAll('.cdk-drag-preview, .cdk-drag-placeholder')) as HTMLElement[];
      previews.forEach(p => {
        try {
          if (p.parentNode) p.parentNode.removeChild(p);
        } catch (e) {
          // If removal fails, fallback to clearing inline positioning
          p.style.transform = '';
          p.style.left = '';
          p.style.top = '';
          p.style.transition = '';
        }
      });

      try { this.cdr.detectChanges(); } catch (e) { /* ignore */ }
    } catch (e) {
      // silent
    }
  }

  // Debug hooks to inspect CDK drag events
  // dropListEntered/dropListSorted handlers removed (no longer used)

  onDragStarted(event: CdkDragStart) {
    try {
      // Allow CDK to create the preview, then remove any stale previews shortly after
      // drag started
      // NOTE: previously we removed stale previews here; disabled to avoid interfering with CDK preview lifecycle
      const data = event.source?.data as MenuGroup | undefined;
      if (data) {
        this.lastDragPrevIndex = this.visibleNavbarEntries.findIndex(v => v.navitem.id === data.navitem.id);
      } else {
        this.lastDragPrevIndex = null;
      }
      this.lastDropHandled = false;
    } catch (e) { /* silent */ }
  }

  onDragMoved(event: CdkDragMove) {
    try {
      /* minimal log to avoid spamming */
      // store last pointer position for use on drag end fallback
      this.lastPointerPosition = { x: event.pointerPosition.x, y: event.pointerPosition.y };
    } catch (e) { /* silent */ }
    // Lightweight mitigation: clamp preview translateX if it becomes absurdly large
    try {
      const preview = document.querySelector('.cdk-drag-preview') as HTMLElement | null;
      if (preview) {
        this.clampPreviewTransform(preview, 0.9);
      }
    } catch (err) {
      /* non-fatal */
    }
  }

  // Clamp the translation components of a transform matrix/matrix3d on the preview element
  // This preserves scale/rotation while preventing runaway translateX values causing the preview
  // to appear far off-screen when dragging quickly to the right.
  private clampPreviewTransform(preview: HTMLElement, maxWindowRatio = 0.9) {
    try {
      const cs = getComputedStyle(preview).transform;
      if (!cs || cs === 'none') return;
      const maxX = Math.max(200, Math.floor(window.innerWidth * (maxWindowRatio || 0.9)));

      const s = cs.trim();
      if (s.startsWith('matrix3d(')) {
        const nums = s.slice(9, -1).split(',').map(n => parseFloat(n.trim()));
        if (nums.length === 16) {
          const tx = nums[12] || 0;
          const ty = nums[13] || 0;
          const clampedTx = Math.max(-maxX, Math.min(maxX, Math.round(tx)));
          const clampedTy = Math.max(-9999, Math.min(9999, Math.round(ty)));
          if (clampedTx !== tx || clampedTy !== ty) {
            nums[12] = clampedTx;
            nums[13] = clampedTy;
            try { preview.style.transform = `matrix3d(${nums.join(',')})`; } catch (e) { /* ignore */ }
          }
        }
      } else if (s.startsWith('matrix(')) {
        const nums = s.slice(7, -1).split(',').map(n => parseFloat(n.trim()));
        if (nums.length === 6) {
          const tx = nums[4] || 0;
          const ty = nums[5] || 0;
          const clampedTx = Math.max(-maxX, Math.min(maxX, Math.round(tx)));
          const clampedTy = Math.max(-9999, Math.min(9999, Math.round(ty)));
          if (clampedTx !== tx || clampedTy !== ty) {
            nums[4] = clampedTx;
            nums[5] = clampedTy;
            try { preview.style.transform = `matrix(${nums.join(',')})`; } catch (e) { /* ignore */ }
          }
        }
      }
    } catch (e) {
      // silent
    }
  }

  async onDragEnded(event: CdkDragEnd) {
    try {
      // drag ended
      // If CDK didn't dispatch a drop (no dropParent), attempt a fallback based on pointer position
      if (!this.lastDropHandled && this.lastDragPrevIndex != null && this.lastPointerPosition) {
        const pos = this.lastPointerPosition;
        // find the target index by scanning children of navDropListRef
        const listEl = this.navDropListRef?.nativeElement as HTMLElement | undefined;
        if (listEl) {
          const items = Array.from(listEl.querySelectorAll(':scope > li')) as HTMLElement[];
          if (items && items.length > 0) {
            const draggedId = (event.source && (event.source.data as MenuGroup)?.navitem?.id) ? (event.source.data as MenuGroup).navitem.id : null;

            // Find candidate anchor element (skip the dragged element itself)
            let anchorId: string | null = null;
            let insertionOffset = 0; // 0 => before anchor, 1 => after anchor

            for (let i = 0; i < items.length; i++) {
              const itemEl = items[i];
              const id = itemEl.getAttribute('data-nav-id');
              if (!id || id === draggedId) continue; // ignore dragged element
              const r = itemEl.getBoundingClientRect();
              const cx = (r.left + r.right) / 2;
              if (pos.x >= r.left && pos.x <= r.right && pos.y >= r.top && pos.y <= r.bottom) {
                anchorId = id;
                insertionOffset = pos.x > cx ? 1 : 0;
                break;
              }
            }

            if (!anchorId) {
              // pick nearest by center X (excluding dragged element)
              let bestId: string | null = null;
              let bestDist = Infinity;
              for (let i = 0; i < items.length; i++) {
                const itemEl = items[i];
                const id = itemEl.getAttribute('data-nav-id');
                if (!id || id === draggedId) continue;
                const r = itemEl.getBoundingClientRect();
                const cx = (r.left + r.right) / 2;
                const d = Math.abs(cx - pos.x);
                if (d < bestDist) { bestDist = d; bestId = id; }
              }
              if (bestId) {
                const anchorEl = items.find(it => it.getAttribute('data-nav-id') === bestId)!;
                const r = anchorEl.getBoundingClientRect();
                const cx = (r.left + r.right) / 2;
                anchorId = bestId;
                insertionOffset = pos.x > cx ? 1 : 0;
              }
            }

            if (anchorId) {
              // Use movedId and anchorId to reorder the full navbarEntries robustly
              const movedId = draggedId;
                if (!movedId) {
                // no movedId available
              } else {
                // Update visible array first for immediate DOM feedback
                const prev = this.lastDragPrevIndex as number;
                // compute tentative visible target index for UI move
                const anchorIndex = this.visibleNavbarEntries.findIndex(v => v.navitem.id === anchorId);
                let tentativeIndex = anchorIndex + insertionOffset;
                if (prev < tentativeIndex) tentativeIndex = Math.max(0, tentativeIndex - 1);
                const newVisibleIndex = Math.max(0, Math.min(this.visibleNavbarEntries.length, tentativeIndex));
                if (this.lastDragPrevIndex != null) {
                  moveItemInArray(this._visibleNavbarEntries, this.lastDragPrevIndex, newVisibleIndex);
                }
                await this.reorderByMovedId(movedId, anchorId, insertionOffset);
                this.lastDropHandled = true;
              }
            }
          }
        }
      }
    } catch (e) { /* silent */ }
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
      external_url: string | null;
      plugin_name: NAVITEM_PLUGIN | null;
      pre_label: 'icon' | 'avatar' | null;
    }
    const formValue = this.navItemForm.value as NavItemFormValue;
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
      sandbox: true,
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
      external_url: isDirectCall ? undefined : (formValue.external_url || undefined),
      plugin_name: isDirectCall ? undefined : (formValue.plugin_name || undefined),
      rank: this.selectedNavitem?.rank ?? 0,
      group_level: this.selectedNavitem?.group_level ?? 0,
    } as NavItem;
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }


}
