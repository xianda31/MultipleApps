import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthentificationRedirectService {
  private returnUrl: string = '/front';
  private context: 'front' | 'back' = 'front';

  setReturnUrl(url: string, context: 'front' | 'back' = 'front'): void {
    this.returnUrl = url;
    this.context = context;
  }

  getReturnUrl(): string {
    const url = this.returnUrl;
    const ctx = this.context;
    this.returnUrl = '/front';
    this.context = 'front';
    return url;
  }

  getContext(): 'front' | 'back' {
    const ctx = this.context;
    return ctx;
  }
}

