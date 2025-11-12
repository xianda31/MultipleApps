
import { Component, ViewChild, Inject, OnDestroy } from '@angular/core';
import { NgbOffcanvas, NgbOffcanvasRef } from '@ng-bootstrap/ng-bootstrap';
import { ToastService } from '../../../common/services/toast.service';
import { NavItemsService } from '../../../common/services/navitem.service';
import { MenuStructure, NavItem, NAVITEM_LOGGING_CRITERIA, NAVITEM_POSITION, NAVITEM_TYPE, NAVITEM_TYPE_ICONS } from '../../../common/interfaces/navitem.interface';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Routes } from '@angular/router';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { NAVITEM_PLUGIN } from '../../../common/interfaces/plugin.interface';
import { PageService } from '../../../common/services/page.service';
import { Page } from '../../../common/interfaces/page_snippet.interface';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { APP_SANDBOX } from '../../../app.config';
import { SandboxService } from '../../../common/services/sandbox.service';
import { DynamicRoutesService } from '../../../common/services/dynamic-routes.service';
import { Subject, combineLatest } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { charsanitize, buildFullPath, extractSegment } from '../../../common/utils/navitem.utils';
// Preview in editor will always be generated from sandbox navitems; no need for static front routes here
// import { path } from 'd3';

@Component({
  selector: 'app-menus-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbDropdownModule, DragDropModule],
  templateUrl: './menus-editor.html',
  styleUrl: './menus-editor.scss'
})
export class MenusEditorComponent  {
  @ViewChild('editNavitemOffcanvas', { static: true }) editNavitemOffcanvas: any;

  selectedNavitem: NavItem | null = null;
  navitems!: NavItem[];
  top_items!: NavItem[];

  NAVITEM_TYPE = NAVITEM_TYPE;
  NAVITEM_TYPES = Object.values(NAVITEM_TYPE);
  NAVITEM_POSITION = NAVITEM_POSITION;
  NAVITEM_POSITIONS = Object.values(NAVITEM_POSITION);
  NAVITEM_TYPE_ICONS = NAVITEM_TYPE_ICONS;
  NAVITEM_PLUGIN = NAVITEM_PLUGIN;
  NAVITEM_PLUGINS = Object.values(NAVITEM_PLUGIN);
  NAVITEM_LOGGING_CRITERIA = NAVITEM_LOGGING_CRITERIA;
  NAVITEM_LOGGING_CRITERIA_VALUES = Object.values(NAVITEM_LOGGING_CRITERIA);

  navbar_verbose = '';
  front_route_verbose = '';
  // Preview auth state toggle (simulation only)
  previewLogged = false;

  front_routes!: Routes;
  navItems: NavItem[] = [];
  menus: MenuStructure = {};
  pages: Page[] = [];
  selected_page: Page | null = null;
  // Ordered list for NAVBAR parents used for DnD at parent level
  navbarEntries: Array<{ parent: NavItem; childs: NavItem[] }> = [];

  navItemForm: FormGroup = new FormGroup({});
  routes!: Routes;
  sandbox_mode: boolean = false;

  private offRef: NgbOffcanvasRef | null = null;
  // Auto-slug helpers
  private slugManuallyEdited = false; // becomes true if user changes slug away from auto-generated value
  private lastAutoSlug = '';
  private skipNextPathUpdate = false; // skip first recompute when opening the editor to avoid duplicate slug in path
  private readonly destroyed$ = new Subject<void>();
  // Sorting helper for keyvalue pipe to sort parents by rank
  compareMenuEntries = (a: any, b: any) => (a?.value?.parent?.rank ?? 0) - (b?.value?.parent?.rank ?? 0);
  // DnD: only allow entering same list (no inter-list transfers)
  sameList = (drag: CdkDrag<unknown>, drop: CdkDropList<unknown>) => drag.dropContainer === drop;



  constructor(
    private navitemService: NavItemsService,
    private fb: FormBuilder,
    private pageService: PageService,
    private toastService: ToastService,
    private offcanvasService: NgbOffcanvas,
    @Inject(APP_SANDBOX) sandboxFlag: boolean,
    public sandboxService: SandboxService,
    private dynamicRoutesService: DynamicRoutesService,
  ) { this.sandbox_mode = sandboxFlag; }


  ngOnInit(): void {
    this.initialise_form();

    // Load navitems and pages together, then enrich once
    combineLatest([
      this.navitemService.loadNavItemsSandbox(),
      this.pageService.listPages()
    ])
      // .pipe(takeUntil(this.destroyed$))
      .subscribe({
        next: ([navitems, pages]) => {
          this.pages = pages;
          console.log('Navitems loaded for menu editor', navitems);
          this.navitems = this.enrichWithPageTitle(navitems);
          // Editor preview always reflects sandbox dataset
          this.front_routes = this.navitemService.generateFrontRoutes(this.navitems);
          this.menus = this.navitemService.getMenuStructure();
          console.log('Menu structure', this.menus);
          this.rebuildNavbarEntries();
        },
        error: (err) => this.toastService.showErrorToast('Chargement', err.message)
      });

    // Initialize front routes for #show_routes preview
    // this.navitemService
    //   .getFrontRoutes(this.sandbox_mode)
    //   .pipe(takeUntil(this.destroyed$))
    //   .subscribe({
    //     next: (routes) => {
    //       this.front_routes = routes;
    //       // Keep dynamic router in sync with computed routes
    //       this.dynamicRoutesService.setRoutes(routes);
    //     },
    //     error: (err) => this.toastService.showErrorToast('Routes', err.message)
    //   });

  }

  setSandbox(flag: boolean) {
    this.sandboxService.setSandbox(flag);
    this.sandbox_mode = flag;
    // Dynamic routes are now reloaded globally by app.config via SandboxService.sandbox$
    this.toastService.showSuccess('Sandbox', flag ? 'Mode sandbox activé' : 'Mode normal activé');
    // Reload navitems for new sandbox mode and rebuild menu structure
    this.reloadNavitems();
  }

  label_transformer(ni: NavItem): string {
    switch (ni.label) {
      case '$$USERNAME$$':
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
    });
    // Reset auto-slug tracking depending on existing slug
  this.lastAutoSlug = charsanitize(this.navItemForm.get('label')?.value || '');
    this.slugManuallyEdited = segment !== '' && segment !== this.lastAutoSlug;
    // Prevent first recompute from appending slug again
    this.skipNextPathUpdate = true;
    this.updateComputedPaths();
    this.offRef = this.offcanvasService.open(this.editNavitemOffcanvas, { position: 'end' });
  }

  saveNavitem() {
    if (!this.selectedNavitem) return;
    const payload = this.buildPayloadFromForm();

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
    console.log('Deleting nav item', selectedNavitem);
    this.navitemService.deleteNavItem(selectedNavitem).then(() => {
      this.toastService.showSuccess('Paramètres menu', 'nav_item supprimé');
      this.offRef?.dismiss('deleted');
      this.offRef = null;
    });
  }

  show_page(item: NavItem) {
    // Simulation click handler: update preview text and log
    this.front_route_verbose = `Prévisualisation: ${item.label} (${item.path})`;
    console.log('[navbar preview] show_page:', item);

    this.selected_page = item.page_id ? this.pages.find(p => p.id === item.page_id) || null : null;
  }

  // Drag-and-drop: reorder children within the same parent and persist rank (0-based)
  dropChild(event: CdkDragDrop<NavItem[]>, parent: NavItem) {
    if (!event.container || event.previousIndex === event.currentIndex) {
      return; // nothing to do
    }
    const list = event.container.data; // the children array
    moveItemInArray(list, event.previousIndex, event.currentIndex);

    // Recompute ranks locally (0-based)
    const updated = list.map((child, idx) => ({ ...child, rank: idx } as NavItem));

    // Optimistic update of local menus snapshot
    // Find the entry matching this parent in current menus and update its childs reference
    const entry = Object.values(this.menus).find(e => e.parent.id === parent.id);
    if (entry) {
      entry.childs.splice(0, entry.childs.length, ...updated);
    }

    // Persist all updated children ranks
    Promise.all(updated.map(child => this.navitemService.updateNavItem(child)))
      .then(() => {
        this.toastService.showSuccess('Menus', 'Ordre des sous-menus mis à jour');
      })
      .catch(err => {
        this.toastService.showErrorToast('Menus', 'Échec mise à jour de l\'ordre');
        console.error('DnD persist error:', err);
      });
  }

  // Drag-and-drop: reorder top-level NAVBAR parents and persist their rank (0-based)
  dropParent(event: CdkDragDrop<Array<{ parent: NavItem; childs: NavItem[] }>>) {
    if (!event.container || event.previousIndex === event.currentIndex) {
      return; // nothing to do
    }
    // We may be dragging in a filtered (preview) view where some parents are hidden.
    // Work on the visible subset then merge back into the full list to keep hidden items stable.
    const visible = this.navbarEntries.filter(e => this.allow(e.parent));
    // Clone visible subset for manipulation
    const working = [...visible];
    moveItemInArray(working, event.previousIndex, event.currentIndex);

    // Rebuild full navbarEntries replacing only allowed (visible) entries in their new order
    const rebuilt: typeof this.navbarEntries = [];
    let vIdx = 0;
    for (const entry of this.navbarEntries) {
      if (this.allow(entry.parent)) {
        rebuilt.push(working[vIdx++]);
      } else {
        rebuilt.push(entry); // keep hidden entry in original relative position
      }
    }
    this.navbarEntries = rebuilt;

    // Recompute ranks globally (0-based) respecting new order
    const updatedParents = this.navbarEntries.map((e, idx) => ({ ...e.parent, rank: idx } as NavItem));

    // Optimistic update of local menus snapshot
    updatedParents.forEach(p => {
      const entry = Object.values(this.menus).find(e => e.parent.id === p.id);
      if (entry) entry.parent = p;
    });

    // Persist all updated parent ranks
    Promise.all(updatedParents.map(p => this.navitemService.updateNavItem(p)))
      .then(() => {
        this.toastService.showSuccess('Menus', 'Ordre des menus mis à jour');
      })
      .catch(err => {
        this.toastService.showErrorToast('Menus', 'Échec mise à jour de l\'ordre');
        console.error('DnD parent persist error:', err);
      });
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
      external_url: new FormControl<string | null>(null),
      plugin_name: new FormControl<string | null>(null),
      pre_label: new FormControl<'icon' | 'avatar' | null>(null),
    });


    // Dynamically require slug (segment) except for Dropdown + enforce allowed characters
    const typeCtrl = this.navItemForm.get('type')!;
    const segCtrlV = this.navItemForm.get('slug')!; // for validators only
    const pathCtrl = this.navItemForm.get('path')!; // read-only preview
    const applySegmentValidators = (t: NAVITEM_TYPE) => {
      if (t === NAVITEM_TYPE.DROPDOWN) {
        segCtrlV.clearValidators();
      } else {
        segCtrlV.setValidators([Validators.required, Validators.pattern(/^[a-z0-9_]+$/)]);
      }
      segCtrlV.updateValueAndValidity({ emitEvent: false });
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
  }

  private enrichWithPageTitle(items: NavItem[]): NavItem[] {
    if (!this.pages || this.pages.length === 0) return items;
    const byId = new Map(this.pages.map(p => [p.id, p.title] as [string, string]));
    return items.map(n => (n.page_id ? { ...n, page_title: byId.get(n.page_id) } : n));
  }

  private reloadNavitems() {
    combineLatest([
      this.navitemService.loadNavItemsSandbox(),
      this.pageService.listPages()
    ])
      .subscribe(([navitems, pages]) => {
        this.pages = pages;
        this.navitems = this.enrichWithPageTitle(navitems);
        this.menus = this.navitemService.getMenuStructure();
        // Preview always built from sandbox items
        this.front_routes = this.navitemService.generateFrontRoutes(this.navitems);
        this.rebuildNavbarEntries();
      });
  }

  private rebuildNavbarEntries() {
    const entries = Object.values(this.menus || {});
    this.navbarEntries = entries
      .filter(e => e.parent.position === NAVITEM_POSITION.NAVBAR)
      .sort((a, b) => (a.parent.rank ?? 0) - (b.parent.rank ?? 0));
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

  hasVisibleChildren(entry: { parent: NavItem; childs: NavItem[] }): boolean {
    if (entry.parent.type !== NAVITEM_TYPE.DROPDOWN) return true;
    return (entry.childs || []).some(c => this.allow(c));
  }

  // private effectiveLoggingCriteria(ni: NavItem): NAVITEM_LOGGING_CRITERIA {
  //   // If the item currently being edited matches, return the in-form (possibly unsaved) value for live preview
  //   if (this.selectedNavitem && this.selectedNavitem.id === ni.id) {
  //     const formCrit = this.navItemForm.get('logging_criteria')?.value as NAVITEM_LOGGING_CRITERIA | undefined;
  //     return formCrit || NAVITEM_LOGGING_CRITERIA.ANY;
  //   }
  //   return ni.logging_criteria || NAVITEM_LOGGING_CRITERIA.ANY;
  // }

  onPreviewToggle(flag: boolean) {
    this.previewLogged = flag;
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
    const segment = formValue.slug || charsanitize(formValue.label || '');
    const fullPath = buildFullPath(segment, formValue.parent_id, this.navitems);
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
      page_id: formValue.page_id || undefined,
      page_title,
      external_url: formValue.external_url || undefined,
      plugin_name: formValue.plugin_name || undefined,
      rank: this.selectedNavitem?.rank ?? 0,
      group_level: this.selectedNavitem?.group_level ?? 0,
    } as NavItem;
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }


}
