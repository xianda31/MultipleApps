import { Component } from '@angular/core';
import { ImgUploadComponent } from '../img-upload/img-upload.component';
import { getUrl, list } from 'aws-amplify/storage';
import { CommonModule } from '@angular/common';
import { get } from 'aws-amplify/api';
import { SiteLayoutService } from '../../../../../../common/services/site-layout.service';
import { Menu, Page } from '../../../../../../common/menu.interface';
import { InputMenuComponent } from "../../input-menu/input-menu.component";
import { Form, FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ToastService } from '../../../../../../common/toaster/toast.service';
import { environment } from '../../../../environments/environment';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TeamSubscriptionComponent } from '../../../modals/team-subscription/team-subscription.component';


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
    private siteLayoutService: SiteLayoutService,
    private toastService: ToastService,
    private modalService: NgbModal
  ) {
    this.siteLayoutService.layout$.subscribe(([menus, pages]) => {
      this.menus = menus;
      this.pages = pages;

    });


    console.log(environment.season);
  }
  toast() {
    this.toastService.showSuccessToast('Success', 'This is a success toast.');
  }

  modal() {
    const modalRef = this.modalService.open(TeamSubscriptionComponent, { centered: true });
    modalRef.componentInstance.title = 'Hello, World!';
    modalRef.result.then((result) => {
      console.log('Modal closed:', result);
    });
  }
}
