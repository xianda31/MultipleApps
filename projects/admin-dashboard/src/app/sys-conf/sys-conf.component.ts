import { AfterViewInit, Component, OnInit } from '@angular/core';
import { SysConfService } from '../../../../common/sys-conf/sys-conf.service';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule, JsonPipe } from '@angular/common';
import { SiteConf } from '../../../../common/sys-conf/sys-conf.interface';




@Component({
  selector: 'app-sys-conf',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, JsonPipe],
  templateUrl: './sys-conf.component.html',
  styleUrl: './sys-conf.component.scss'
})
export class SysConfComponent implements OnInit {


  siteConf: SiteConf = {
    color: undefined,
    web_site_menus: []
  };

  sysconfGroup: FormGroup = new FormGroup({
    siteConfJson: new FormControl('')
  });

  get siteConfJson() { return this.sysconfGroup.get('siteConfJson') }

  constructor(
    private sysconfService: SysConfService
  ) { }

  ngOnInit(): void {
    this.getConf();
  }

  getConf() {
    this.sysconfService.getSysConfRaw().then((data) => {
      this.siteConfJson!.patchValue(data);
      this.siteConf = JSON.parse(this.siteConfJson!.value);
    });
  }
  saveConf() {
    if (this.sysconfGroup.invalid) {
      return;
    }
    this.sysconfService.saveSysConfRaw(this.siteConfJson!.value).then(() => {
      console.log('saved');
      this.getConf();
    });
  }

}
