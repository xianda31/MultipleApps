function parentRequiredIfNotTop(group: AbstractControl) {
  const top = group.get('top')?.value;
  const parent_id = group.get('parent_id')?.value;
  if (!top && !parent_id) {
    return { parentRequired: true };
  }
  return null;
}

import { Component } from '@angular/core';
import { ToastService } from '../../../common/services/toast.service';
import { NavItemsService } from '../../../common/services/navitem.service';
import { NavItem, NAVITEM_POSITION, NAVITEM_TYPE } from '../../../common/interfaces/navitem.interface';
import { AbstractControl, Form, FormArray, FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-menus-editor',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './menus-editor.html',
  styleUrl: './menus-editor.scss'
})
export class MenusEditorComponent {

  navitems!: NavItem[];
  top_items!: NavItem[];
  new_navitemGroup!: FormGroup;

  navitem_selected = false;

  NAVITEM_TYPE = NAVITEM_TYPE
  NAVITEM_TYPE_ARRAY = Object.values(NAVITEM_TYPE);
  NAVITEM_POSITION = NAVITEM_POSITION
  NAVITEM_POSITION_ARRAY = Object.values(NAVITEM_POSITION);

  constructor(
    private navitemService: NavItemsService,
    private toastService: ToastService,
    private fb: FormBuilder
  ) {
    this.init_form();
    // Subscribe to changes on new_navitemGroup
    this.new_navitemGroup.valueChanges.subscribe(() => {
      this.navitemChange(this.new_navitemGroup);
    });
  }


  ngOnInit(): void {

    this.navitemService.loadNavItems().subscribe({
      next: (navitems) => {
        this.navitems = navitems.sort((a, b) => {
          return a.link.localeCompare(b.link);
        });
        this.top_items = navitems.filter(item => item.top);
        console.log('Menus loaded', this.navitems);
      },
      error: (err) => {
        this.toastService.showErrorToast('Error loading navitem', err.message);
      }
    });
  }

  init_form() {
    this.new_navitemGroup = new FormGroup({
      id: new FormControl(''),
      label: new FormControl('', Validators.required),
      top: new FormControl(true, Validators.required),
      parent_id: new FormControl(''),
      position: new FormControl(NAVITEM_POSITION, Validators.required),
      link: new FormControl(''),
      type: new FormControl(NAVITEM_TYPE, Validators.required),
    }, { validators: parentRequiredIfNotTop });
  }

  get_parent(id: string | undefined): string {
    if (!id) return '??';
    const parent = this.navitems.find(item => item.id === id);
    return parent ? parent.label : '??';
  }

  private charsanitize(str: string): string {
    return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
  }

  navitemChange(navitem: FormGroup) {
    const navitemValue = navitem.value as NavItem;

    // If top and type is dropdown, set link to 'label-sanitized'
    if (navitemValue.top) {
      navitem.patchValue({ parent_id: null }, { emitEvent: false });
      if (navitemValue.type === NAVITEM_TYPE.DROPDOWN) {
        navitem.patchValue({ link: this.charsanitize(navitemValue.label) }, { emitEvent: false });
      } else {
        navitem   .patchValue({ link: '' }, { emitEvent: false });
      }

    } else {
      //  traitement sous-menus

      const parent = this.navitems.find(item => item.id === navitemValue.parent_id);
      if (!parent) {
        // this.toastService.showErrorToast('Parent menu not found', navitemValue.parent_id!);
        return;
      } else {
        navitem.patchValue({
          link: this.charsanitize(parent.label) + '/' + this.charsanitize(navitemValue.label),
          position: parent.position,
        }, { emitEvent: false });
      }
    }
  }

  editNavitem(navitem: NavItem) {
    this.new_navitemGroup.patchValue({
      id: navitem.id,
      parent_id: navitem.parent_id,
      top: navitem.top,
      position: navitem.position,
      label: navitem.label,
      link: navitem.link,
      type: navitem.type,
    });
    this.navitem_selected = true;
  }


  form_filled() {
    return this.new_navitemGroup.valid;
  }
  onCreateNavitem() {
    this.new_navitemGroup.markAllAsTouched();
    if (this.new_navitemGroup.invalid) {
      return;
    }
    let new_navitem = this.new_navitemGroup.getRawValue();
    this.navitemService.createNavItem(new_navitem);
    this.new_navitemGroup.reset();
    this.navitem_selected = false;
  }

  onReadNavitem(navitem: NavItem) {
    this.new_navitemGroup.patchValue(navitem);
    this.navitem_selected = true;
  }

  onUpdateNavitem() {
    let navitem = this.new_navitemGroup.getRawValue();
    this.navitemService.updateNavItem(navitem);
    this.navitem_selected = false;
    this.new_navitemGroup.reset();
  }
  onDeleteNavitem(navitem: NavItem) {
   this.navitemService.deleteNavItem(navitem).then(() => {
      this.toastService.showSuccess('Gestion des menus', `Menu ${navitem.label} supprimé avec succès`);
      this.navitem_selected = false;
      this.new_navitemGroup.reset();
    }).catch(err => {
      this.toastService.showErrorToast('Gestion des menus', err.message);
    });
  }
  }
