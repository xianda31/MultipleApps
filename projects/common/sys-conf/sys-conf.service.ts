import { Injectable } from '@angular/core';
import { SiteConf } from './sys-conf.interface';

@Injectable({
  providedIn: 'root'
})
export class SysConfService {
  conf = {
    color: 'blue',
    web_site_menus: [
      { label: 'Accueil', has_submenu: false, route: { path: 'home', componentEnum: 'generic-simple-page', name: 'home' } },
      { label: 'Contact', has_submenu: false, route: { path: 'contact', componentEnum: 'generic-simple-page', name: 'contact' } },
      {
        label: 'La vie du Club', has_submenu: true, submenus: [
          { label: 'Historique', has_submenu: false, route: { path: 'historique', componentEnum: 'generic-simple-page', name: 'historique' } },
          { label: 'Organisation', has_submenu: false, route: { path: 'organisation', componentEnum: 'generic-simple-page', name: 'organisation' } },
          { label: 'Les installations', has_submenu: false, route: { path: 'installations', componentEnum: 'generic-simple-page', name: 'installations' } },
          { label: 'Les tarifs', has_submenu: false, route: { path: 'tarifs', componentEnum: 'generic-simple-page', name: 'tarifs' } },
          { label: 'Les partenaires', has_submenu: false, route: { path: 'partenaires', componentEnum: 'generic-simple-page', name: 'partenaires' } },
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
