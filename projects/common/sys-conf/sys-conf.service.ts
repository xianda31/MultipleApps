import { Injectable } from '@angular/core';
import { SiteConf } from './sys-conf.interface';

@Injectable({
  providedIn: 'root'
})
export class SysConfService {
  conf: SiteConf = {
    color: 'blue',
    web_site_menus: [
      { label: 'Accueil', has_submenu: false, endItem: { link: 'home', pageId: 'home' } },
      { label: 'Contact', has_submenu: false, endItem: { link: 'contact', pageId: 'contact' } },
      {
        label: 'La vie du Club', has_submenu: true, submenus: [
          { label: 'Historique', has_submenu: false, endItem: { link: 'historique', pageId: 'historique' } },
          { label: 'Organisation', has_submenu: false, endItem: { link: 'organisation', pageId: 'organisation' } },
          { label: 'Les installations', has_submenu: false, endItem: { link: 'installations', pageId: 'installations' } },
          { label: 'Les tarifs', has_submenu: false, endItem: { link: 'tarifs', pageId: 'tarifs' } },
          { label: 'Les partenaires', has_submenu: false, endItem: { link: 'partenaires', pageId: 'partenaires' } },
        ]
      }
    ]
  }
  confJSON = JSON.stringify(this.conf);

  constructor() { }

  getSysConf(): Promise<SiteConf> {
    let promise = new Promise<SiteConf>((resolve, reject) => {
      setTimeout(() => {
        let conf = JSON.parse(this.confJSON);
        resolve(conf);
      }, 0);
    });
    return promise;
  }

  getSysConfRaw(): Promise<string> {
    let promise = new Promise<string>((resolve, reject) => {
      setTimeout(() => {
        resolve(this.confJSON);
      }, 200);
    });
    return promise;
  }

  saveSysConfRaw(conf: string): Promise<void> {
    let promise = new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        this.confJSON = conf;
        resolve();
      }, 200);
    });
    return promise;
  }
}
