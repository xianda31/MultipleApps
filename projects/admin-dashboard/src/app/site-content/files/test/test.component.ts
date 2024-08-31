import { Component } from '@angular/core';
import { ImgUploadComponent } from '../img-upload/img-upload.component';
import { getUrl, list } from 'aws-amplify/storage';
import { CommonModule } from '@angular/common';
import { get } from 'aws-amplify/api';
import { SiteLayoutService } from '../../../../../../common/services/site-layout.service';
import { Menu, Page } from '../../../../../../common/menu.interface';
import { InputMenuComponent } from "../../input-menu/input-menu.component";
import { Form, FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';


@Component({
  selector: 'app-test',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, InputMenuComponent],
  templateUrl: './test.component.html',
  styleUrl: './test.component.scss'
})

export class TestComponent {
  pages: Page[] = [];
  menus: Menu[] = [];

  inputGroup: FormGroup = new FormGroup({
    menu_id: new FormControl()
  });

  get menu_id() {
    return this.inputGroup.get('menu_id')!.value;
  }

  constructor(
    private siteLayoutService: SiteLayoutService
  ) {
    this.siteLayoutService.layout$.subscribe(([menus, pages]) => {
      this.menus = menus;
      this.pages = pages;

    });

  }


}

