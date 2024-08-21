import { Injectable } from '@angular/core';
import { SiteConf } from './sys-conf.interface';

@Injectable({
  providedIn: 'root'
})
export class SysConfService {
  conf: SiteConf = {
    color: 'blue',
    web_site_menus: [
      { label: 'Contact', has_submenu: false, endItems: [{ label: 'Contact', link: 'contact', pageId: 'contact' }] },
      { label: 'Accueil', has_submenu: false, endItems: [{ label: 'Accueil', link: 'home', pageId: 'home' }] },
      {
        label: 'La vie du Club', has_submenu: true,
        endItems: [
          { label: 'Historique', link: 'historique', pageId: 'historique' },
          { label: 'Organisation', link: 'organisation', pageId: 'organisation' },
          { label: 'Les installations', link: 'installations', pageId: 'installations' },
          { label: 'Les tarifs', link: 'tarifs', pageId: 'tarifs' },
          { label: 'Les partenaires', link: 'partenaires', pageId: 'partenaires' },
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
