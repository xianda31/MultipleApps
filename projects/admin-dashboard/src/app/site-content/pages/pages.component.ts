import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import { Menu, Page } from '../../../../../common/menu.interface';
import { SiteLayoutService } from '../../../../../common/site-layout_and_contents/site-layout.service';

@Component({
  selector: 'app-pages',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './pages.component.html',
  styleUrl: './pages.component.scss'
})
export class PagesComponent {

  // @Input() menus!: Menu[];
  // @Output() pageChange: EventEmitter<Page> = new EventEmitter<Page>();
  pages: Page[] = [];
  menus: Menu[] = [];

  layout_loaded: boolean = false;
  creation: boolean = true;

  pageGroup: FormGroup = new FormGroup({
    id: new FormControl(''),
    menuId: new FormControl('', Validators.required),
    link: new FormControl('', Validators.required),
    template: new FormControl('', Validators.required),
  });

  constructor(
    private siteLayoutService: SiteLayoutService
  ) {
    this.siteLayoutService.layout$.subscribe(([menus, pages]) => {
      this.menus = menus;
      this.pages = pages;
      this.layout_loaded = true;
      // console.log('layout', menus, pages);
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
    let page = this.pageGroup.getRawValue() as Page;
    this.creation ? this.createPage(page) : this.updatePage(page);
    this.onClear();
  }

  createPage(page: Page): void {
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

