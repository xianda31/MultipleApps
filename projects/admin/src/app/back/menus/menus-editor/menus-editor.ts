
import { Component, ViewChild } from '@angular/core';
import { NgbOffcanvas, NgbOffcanvasRef } from '@ng-bootstrap/ng-bootstrap';
import { ToastService } from '../../../common/services/toast.service';
import { NavItemsService } from '../../../common/services/navitem.service';
import { MenuStructure, NavItem, NAVITEM_POSITION, NAVITEM_TYPE, NAVITEM_TYPE_ICONS } from '../../../common/interfaces/navitem.interface';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Routes } from '@angular/router';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { NAVITEM_PLUGIN } from '../../../common/interfaces/plugin.interface';
import { PageService } from '../../../common/services/page.service';
import { Page } from '../../../common/interfaces/page_snippet.interface';
// import { path } from 'd3';

@Component({
  selector: 'app-menus-editor',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbDropdownModule],
  templateUrl: './menus-editor.html',
  styleUrl: './menus-editor.scss'
})
export class MenusEditorComponent {
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

  navbar_verbose = '';
  front_route_verbose = '';

  front_routes!: Routes;
  navItems: NavItem[] = [];
  menus: MenuStructure = {};
  pages: Page[] = [];
  selected_page: Page | null = null;

  navItemForm: FormGroup = new FormGroup({});
  routes!: Routes;

  private offRef: NgbOffcanvasRef | null = null;

  

  constructor(
    private navitemService: NavItemsService,
    private fb : FormBuilder,
    private pageService: PageService,
    private toastService: ToastService,
    private offcanvasService: NgbOffcanvas
  ) { }


  ngOnInit(): void {

    this.navItemForm = this.fb.group({
      type: new FormControl('', { validators: [Validators.required] }),
      label: new FormControl('', { validators: [Validators.required] }),
      slug: new FormControl(''),
      path: new FormControl({ value: '', disabled: true }),
      position: new FormControl('', { validators: [Validators.required] }),
      parent_id: new FormControl<string | null>(null),
      page_id: new FormControl<string | null>(null),
      external_url: new FormControl<string | null>(null),
      plugin_name: new FormControl<string | null>(null),
    });


    // Dynamically require slug (segment) except for Dropdown + enforce allowed characters
    const typeCtrl = this.navItemForm.get('type')!;
    const segCtrl = this.navItemForm.get('slug')!;
    const pathCtrl = this.navItemForm.get('path')!; // read-only preview
    const applySegmentValidators = (t: NAVITEM_TYPE) => {
      if (t === NAVITEM_TYPE.DROPDOWN) {
        segCtrl.clearValidators();
      } else {
        segCtrl.setValidators([Validators.required, Validators.pattern(/^[a-z0-9_]+$/)]);
      }
      segCtrl.updateValueAndValidity({ emitEvent: false });
    };

  applySegmentValidators(typeCtrl.value as NAVITEM_TYPE);
  typeCtrl.valueChanges.subscribe((t: NAVITEM_TYPE) => applySegmentValidators(t));

  // Auto-generate full path preview from parent.path + '/' + path (or slug(label) fallback)
  const recompute = () => this.updateComputedPaths();
  this.navItemForm.get('label')?.valueChanges.subscribe(recompute);
  this.navItemForm.get('parent_id')?.valueChanges.subscribe(recompute);
  this.navItemForm.get('slug')?.valueChanges.subscribe(recompute);

  // Sanitize slug on-the-fly to keep only [a-z0-9_]
  this.navItemForm.get('slug')?.valueChanges.subscribe((v) => {
    if (typeof v === 'string') {
      const sanitized = this.charsanitize(v);
      if (sanitized !== v) {
        segCtrl.setValue(sanitized, { emitEvent: false });
      }
    }
  });

    this.navitemService.loadNavItems().subscribe({
      next: (navitems) => {
        console.log('Navitems loaded', navitems);
        this.navitems = navitems;
        this.menus = this.navitemService.getMenuStructure();
      },
      error: (err) => {
        this.toastService.showErrorToast('Error loading navitem', err.message);
      }
    });

    this.navitemService.getFrontRoutes().subscribe(routes => {
      this.front_routes = routes;
    });

    // Charger les pages pour le type CustomPage
    this.pageService.listPages().subscribe(pages => {
      this.pages = pages;
    });

  }


// generateMenuStructure(navitems: NavItem[]): { [key: string]: { parent: NavItem, childs: NavItem[] } } {
//     const menuStructure: { [key: string]: { parent: NavItem, childs: NavItem[] } } = {};
//     const parentItems = navitems.filter(n => !n.parent_id);
//     parentItems.forEach(parent => {
//         menuStructure[parent.id] = { parent, childs: [] };
//     });
//     navitems.forEach(child => {
//         if (child.parent_id) {
//             const parent = menuStructure[child.parent_id];
//             if (parent) {
//                 parent.childs.push(child);
//             }
//         }
//     });
//     return menuStructure;
// } 

  private charsanitize(str: string): string {
    // Supprime les accents mais garde la lettre (é → e)
    return str
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
  }

  private buildFullPath(pathSegment: string, parent_id: string | null | undefined): string {
    const segment = (pathSegment || '').replace(/^\/+|\/+$/g, '');
    const parent = parent_id ? this.navitems?.find(n => n.id === parent_id) : null;
    const prefix = parent?.path ? parent.path.replace(/^\/+|\/+$/g, '') : '';
    return prefix ? `${prefix}/${segment}` : segment;
  }

  private extractSegment(item: NavItem): string {
    const parent = item.parent_id ? this.navitems?.find(n => n.id === item.parent_id) : null;
    if (parent && parent.path && item.path && item.path.startsWith(parent.path + '/')) {
      return item.path.substring(parent.path.length + 1);
    }
    // fallback: last segment after '/'
    const parts = (item.path || '').split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : '';
  }

  private updateComputedPaths() {
    const label = this.navItemForm.get('label')?.value || '';
    const parent_id = this.navItemForm.get('parent_id')?.value || null;
  const segCtrl = this.navItemForm.get('slug');
    const currentSeg = segCtrl?.value as string;
    // If user hasn't modified segment yet, propose a slug from label
    if (segCtrl && (currentSeg == null || currentSeg === '') && segCtrl.pristine) {
      const suggested = this.charsanitize(label);
      if (suggested) {
        segCtrl.setValue(suggested, { emitEvent: false });
      }
    }
  const segment = (this.navItemForm.get('slug')?.value as string) || this.charsanitize(label);
    // Compute full path and update preview control
    const full = this.buildFullPath(segment, parent_id);
    this.navItemForm.get('path')?.setValue(full, { emitEvent: false });
  }

  createNavItem() {
    this.editNavitem();
  }

  editNavitem(navItem?: any) : void {
    if(navItem) {
      this.selectedNavitem = { ...navItem };
    } else {
      this.selectedNavitem = {
        id: '',
        type: NAVITEM_TYPE.INTERNAL_LINK,
        label: '',
        slug: '',
        path: '',
        position: NAVITEM_POSITION.NAVBAR,
      };
    }
    // Patcher le formulaire avec la sélection
    const segment = this.extractSegment(this.selectedNavitem!);
    this.navItemForm.reset({
      type: this.selectedNavitem!.type,
      label: this.selectedNavitem!.label || '',
      slug: segment,
      path: this.selectedNavitem!.path || '',
      position: this.selectedNavitem!.position || NAVITEM_POSITION.NAVBAR,
      parent_id: this.selectedNavitem!.parent_id || null,
      page_id: this.selectedNavitem!.page_id || null,
      external_url: this.selectedNavitem!.external_url || null,
      plugin_name: this.selectedNavitem!.plugin_name || null,
    });
    this.updateComputedPaths();
    this.offRef = this.offcanvasService.open(this.editNavitemOffcanvas, { position: 'end' });
  }

  saveNavitem() {
    if (!this.selectedNavitem) return;
    const formValue = this.navItemForm.value;
    const segment = formValue.slug || this.charsanitize(formValue.label || '');
    const fullPath = this.buildFullPath(segment, formValue.parent_id);
    const payload: NavItem = {
      id: this.selectedNavitem.id,
      type: formValue.type,
      label: formValue.label,
      slug: segment,
      path: fullPath,
      position: formValue.position,
      parent_id: formValue.parent_id || undefined,
      page_id: formValue.page_id || undefined,
      external_url: formValue.external_url || undefined,
      plugin_name: formValue.plugin_name || undefined,
    } as NavItem;

    const op = payload.id ? this.navitemService.updateNavItem(payload) : this.navitemService.createNavItem(payload);
    op.then((res) => {
      this.toastService.showSuccess('Paramètres menu', 'nav_item sauvegardé');
      this.selectedNavitem = null;
      this.offRef?.dismiss('saved');
      this.offRef = null;
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


}
