
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

  navbar_verbose = '';
  front_route_verbose = '';

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
      this.pages = pages;
    });




    this.navitemService.loadNavItems().subscribe({
      next: (navitems) => {
        this.navitems = navitems.sort((a, b) => {
          return a.path.localeCompare(b.path);
        });
        this.top_items = navitems.filter(item => item.top);
        this.menus = this.generate_ul();
      },
      error: (err) => {
        this.toastService.showErrorToast('Error loading navitem', err.message);
      }
    });
  }

private add_to_navbar(navitem: NavItem, component: string) {
  if (navitem.top) {
  this.navbar_verbose += `<li ngbDropdown>  ${navitem.label} </li> \n`;
  this.front_route_verbose += `{ path: '${navitem.root}', component: ${component} }, \n`;
  }else {
    this.navbar_verbose += `<li> routerLink="${navitem.root}/${navitem.path}"> ${navitem.label} </li> \n`;
    this.front_route_verbose += `{ path: '${navitem.root}/${navitem.path}', component: ${component} }, \n`;
  }

  // console.log("<li> routerLink=\"%s\"> %s </li>", path, label);
}

private process_navitem(navitem: NavItem) {
  switch (navitem.type) {
    case NAVITEM_TYPE.DROPDOWN:
     this.add_to_navbar(navitem, 'DropdownComponent');
      break;
    case NAVITEM_TYPE.CUSTOM_PAGE:
      this.add_to_navbar(navitem, 'GenericPageComponent');
      break;
    case NAVITEM_TYPE.PLUGIN:
      this.add_to_navbar(navitem, navitem.plugin_name!);
      break;
    case NAVITEM_TYPE.INTERNAL_LINK:
      this.add_to_navbar(navitem, 'InternalLinkComponent');
      break;
    case NAVITEM_TYPE.EXTERNAL_REDIRECT:
      this.add_to_navbar(navitem, 'ExternalRedirectComponent');
      break;
    default:
      console.warn('Unknown menu type', navitem);
      break;
  }
}


  build_front_routes() {
    // reset_plugin_routes();

this.front_route_verbose = '';
this.navbar_verbose = '';

    for (const [key, value] of Object.entries(this.menus)) {
      const { parent, childs } = value;
      this.process_navitem(parent);
      childs.forEach(child => {
        this.process_navitem(child);
      });
    }

    // console.log('Front routes built', plugin_routes);
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
    // Supprime les accents mais garde la lettre (é → e)
    return str
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
  }

  gen_path(navitem: NavItem): string {
      return this.charsanitize(navitem.path);
  }

  get_root(navitem: NavItem): string {
    if (navitem.top) {
      return this.charsanitize(navitem.label);
    } else {
      const parent = this.navitems.find(item => item.id === navitem.parent_id);
      console.log('get_root: navitem', navitem, 'parent', parent);
      return parent ? this.charsanitize(parent.label) : '?!?';
    }
  }
    
  

  createSubNavitem(parent: NavItem) {
    const new_navitem: NavItem = {
      id: '',

      label: '',
      top: false,
      root: parent.root,
      path: '#',
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
      label: '',
      top: true,
      parent_id: undefined,
      position: position,
      root:this.charsanitize('New menu'),
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


    editNavitem(navItem: any) {
      navItem.root = this.get_root(navItem);   // force update of root if any change of parent
    this.selectedNavitem = { ...navItem };

    this.offcanvasService.open(this.editNavitemOffcanvas, { position: 'end' });
  }

  saveNavitem(selectedNavitem: NavItem) {

    if (!selectedNavitem) return;

    if(selectedNavitem.top) {
      selectedNavitem.root = this.charsanitize(selectedNavitem.label);
      // force childs root update
     this.menus[selectedNavitem.label]?.childs.forEach(async child => {
        if(child.root !== selectedNavitem.root) {
          child.root = selectedNavitem.root;
          await this.navitemService.updateNavItem(child);
        }
      });
    } else {
      // force path update if not set
      if (selectedNavitem.path ==='#') {
        selectedNavitem.path = this.gen_path(selectedNavitem);
      }
    }

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
