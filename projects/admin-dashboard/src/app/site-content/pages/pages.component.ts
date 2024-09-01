import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import { Menu, Page, PageTemplateEnum } from '../../../../../common/menu.interface';
import { SiteLayoutService } from '../../../../../common/services/site-layout.service';
import { InputMenuComponent } from "../input-menu/input-menu.component";

@Component({
  selector: 'app-pages',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, InputMenuComponent],
  templateUrl: './pages.component.html',
  styleUrl: './pages.component.scss'
})
export class PagesComponent {

  // @Input() menus!: Menu[];
  // @Output() pageChange: EventEmitter<Page> = new EventEmitter<Page>();
  pages: Page[] = [];
  menus: Menu[] = [];

  templates = PageTemplateEnum;
  templates_values: string[] = Object.values(this.templates);

  layout_loaded: boolean = false;
  creation: boolean = true;

  pageGroup: FormGroup = new FormGroup({
    id: new FormControl(''),
    menuId: new FormControl({ value: '', disabled: true }),
    menu: new FormControl<Menu | null>(null),
    link: new FormControl('', Validators.required),
    template: new FormControl('', Validators.required),
    rank: new FormControl(0)
  });

  constructor(
    private siteLayoutService: SiteLayoutService
  ) {
    this.siteLayoutService.layout$.subscribe(([menus, pages]) => {
      this.menus = menus;
      this.pages = pages;
      this.layout_loaded = true;
    });

  }

  getMenuLabel(id: string): string | null {
    let menu = this.menus.find((m) => m.id === id);
    if (!menu) return null;
    return menu.label;
  }
  get menuId() { return this.pageGroup.get('menuId')?.value; }

  onClear() {
    this.pageGroup.reset();
  }
  onEdit(page: Page) {
    this.pageGroup.patchValue(page);
    let menu = this.menus.find((m) => m.id === page.menuId);
    this.pageGroup.patchValue({ menu: menu });
    this.creation = false;
  }

  onDelete(pageId: string): void {
    this.siteLayoutService.deletePage(pageId).then((deletedPage) => {
    }).catch((error) => {
      console.error('page deletion error', error);
    });
  }
  onSave() {
    if (this.pageGroup.invalid) return;
    // recuperation du menu retourné par input-menu , et ajout de son id dans le menuId 
    //et suppression de la propriété menu pour coller au model de page
    let menu = this.pageGroup.get('menu')?.value;
    this.pageGroup.patchValue({ menuId: menu.id });
    let page = this.pageGroup.getRawValue();
    delete page.menu;

    this.creation ? this.createPage(page) : this.updatePage(page);
    this.onClear();
  }

  createPage(page: Page): void {
    // mettre la nouvelle page en dernier rang
    let menu = this.menus.find((m) => m.id === page.menuId);
    if (!menu) {
      console.error('menu not found for page', page);
      return;
    }
    page.rank = menu.pages?.length + 1;

    this.siteLayoutService.createPage(page).then((newPage) => {
    }).catch((error) => {
      console.error('page creation error', page, error);
    });
  }

  updatePage(page: Page): void {
    this.siteLayoutService.updatePage(page).then((updatedPage) => {
    }).catch((error) => {
      console.error('page update error', error);
    });
  }


}

