import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class InternalLinkRoutingService {
  private handlerAttached = false;

  constructor(private router: Router) {}

  public attachGlobalPointerHandler(): void {
    if (this.handlerAttached) return;
    document.body.addEventListener('pointerdown', (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'A') {
        let href = target.getAttribute('href');
        if (href && (/^(\/|\.\/|\.\.)/.test(href))) {
          event.preventDefault();
          event.stopPropagation();
          if (href.startsWith('./')) {
            href = '/' + href.slice(2);
          } else if (href.startsWith('../')) {
            while (href.startsWith('../')) {
              href = href.slice(3);
            }
            href = '/' + href;
          }
          this.router.navigateByUrl(href);
        }
      }
    }, true);
    this.handlerAttached = true;
  }
}
