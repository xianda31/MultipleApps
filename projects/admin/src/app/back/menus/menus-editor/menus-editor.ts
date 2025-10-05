
import { Component, ViewChild } from '@angular/core';
import { NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { ToastService } from '../../../common/services/toast.service';
import { NavItemsService } from '../../../common/services/navitem.service';
import { NavItem, NAVITEM_POSITION, NAVITEM_TYPE, NAVITEM_TYPE_ICONS } from '../../../common/interfaces/navitem.interface';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Routes } from '@angular/router';
import { NAVITEM_PLUGIN } from '../../../common/interfaces/plugin.interface';
import { PageService } from '../../../common/services/page.service';
import { Page } from '../../../common/interfaces/page_snippet.interface';

@Component({
  selector: 'app-menus-editor',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
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


  front_routes!: Routes;
  menus: { [key: string]: { parent: NavItem, childs: NavItem[] } } = {};
  pages: Page[] = [];

  constructor(
    private navitemService: NavItemsService,
    private pageService: PageService,
    private toastService: ToastService,
    private offcanvasService: NgbOffcanvas
  ) { }


  ngOnInit(): void {


    this.pageService.listPages().subscribe(pages => {
      console.log('Pages loaded', pages);
      this.pages = pages;
    });

    this.navitemService.buildFrontRoutes().subscribe(routes => {
      this.front_routes = routes;
      console.log('Front routes built', this.front_routes);
    });



    this.navitemService.loadNavItems().subscribe({
      next: (navitems) => {
        this.navitems = navitems.sort((a, b) => {
          return a.path.localeCompare(b.path);
        });
        this.top_items = navitems.filter(item => item.top);
        this.menus = this.generate_ul();
        console.log('Menus loaded', this.menus);
      },
      error: (err) => {
        this.toastService.showErrorToast('Error loading navitem', err.message);
      }
    });
  }


  generate_ul(): { [key: string]: { parent: NavItem, childs: NavItem[] } } {
    const ul: { [key: string]: { parent: NavItem, childs: NavItem[] } } = {};
    this.navitems.forEach(item => {
      if (!item.top) {
        const parent = this.navitems.find(parent => parent.id === item.parent_id);
        if (parent) {
          if (!ul[parent.label]) {
            ul[parent.label] = { parent: parent, childs: [] };
          }
          ul[parent.label].childs.push(item);
        }
      } else {
        if (!ul[item.label]) {
          ul[item.label] = { parent: item, childs: [] };
        }
      }
    });
    return ul;
  }

  editNavitem(navItem: any) {
    this.selectedNavitem = { ...navItem };
    this.offcanvasService.open(this.editNavitemOffcanvas, { position: 'end' });
  }

  types_allowed(top: boolean) {
    return top ? this.NAVITEM_TYPES : this.NAVITEM_TYPES.filter(type => type !== NAVITEM_TYPE.DROPDOWN);
  }

  has_submenus(parent_label: string): boolean {
    if (!parent_label) return false;
    return this.menus[parent_label] && this.menus[parent_label].childs.length > 0;
  }

  get_parent(id: string | undefined): string {
    if (!id) return 'n/a';
    const parent = this.navitems.find(item => item.id === id);
    return parent ? parent.label : 'n/a';
  }

  private charsanitize(str: string): string {
    return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
  }


  createSubNavitem(parent: NavItem) {
    const new_navitem: NavItem = {
      id: '',

      label: 'New sub-menu',
      top: false,
      path: this.charsanitize(parent.label) + '/' + this.charsanitize('New sub-menu'),
      position: parent.position,
      // optional params
      parent_id: parent.id,
      type: NAVITEM_TYPE.CUSTOM_PAGE,
    };
    this.navitemService.createNavItem(new_navitem).then((created) => {
      this.toastService.showSuccess('Gestion des menus', `Menu ${created.label} créé avec succès`);
      // this.editNavitem(created);
    }).catch(err => {
      this.toastService.showErrorToast('Gestion des menus', err.message);
    });
  }


  createTopNavitem(position: NAVITEM_POSITION) {
    const new_navitem: NavItem = {
      id: '',
      label: 'New menu',
      top: true,
      parent_id: undefined,
      position: position,
      path: '#',
      type: NAVITEM_TYPE.INTERNAL_LINK,
    };
    this.navitemService.createNavItem(new_navitem).then((created) => {
      this.toastService.showSuccess('Gestion des menus', `Menu ${created.label} créé avec succès`);
      // this.editNavitem(created);
    }).catch(err => {
      this.toastService.showErrorToast('Gestion des menus', err.message);
    });

  }


  saveNavitem(selectedNavitem: NavItem) {
    // Logique pour enregistrer les modifications du nav item
    console.log('Saving nav item', selectedNavitem);
    this.navitemService.updateNavItem(selectedNavitem!);
    this.toastService.showSuccess('Paramètres menu', 'nav_item sauvegardé');
  }

  deleteNavitem(selectedNavitem: NavItem) {
    // Logique pour supprimer le nav item
    console.log('Deleting nav item', selectedNavitem);
    this.navitemService.deleteNavItem(selectedNavitem).then(() => {
      this.toastService.showSuccess('Paramètres menu', 'nav_item supprimé');
    });
  }


}
