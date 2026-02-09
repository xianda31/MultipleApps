import { Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-iframe',
  imports: [],
  templateUrl: './iframe.html',
  styleUrl: './iframe.scss'
})
export class IframeComponent implements OnInit {
  @Input() external_url: string = '';
  safeUrl: SafeResourceUrl | null = null;

  constructor(
    private sanitizer: DomSanitizer,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    // Try from @Input first (via withComponentInputBinding), fallback to route.data
    if (!this.external_url) {
      this.external_url = this.route.snapshot.data['external_url'] || '';
    }
    
    if (this.external_url) {
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.external_url);
    }
  }
}
