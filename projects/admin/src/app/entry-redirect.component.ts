import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LocalStorageService } from './back/services/local-storage.service';

@Component({
  selector: 'app-entry-redirect',
  standalone: true,
  template: '<!-- entry redirect placeholder -->'
})
export class EntryRedirectComponent {
  constructor(private ls: LocalStorageService, private router: Router) {}
  ngOnInit() {
    const raw = this.ls.getItem('entry_point');
    const entry = typeof raw === 'string' ? raw : (raw ?? '');
    switch (entry) {
      case 'back':
        this.router.navigateByUrl('/back');
        break;
      case 'front':
      default:
        this.router.navigateByUrl('/front');
        break;
    }
  }
}
