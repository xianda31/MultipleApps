import { Component, Input, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-iframe',
  imports: [],
  templateUrl: './iframe.html',
  styleUrl: './iframe.scss'
})
export class IframeComponent implements OnInit {
  @Input() external_url: string = '';
  safeUrl: SafeResourceUrl = '';

  constructor(private sanitizer: DomSanitizer) { }

  ngOnInit(): void {
    this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.external_url);
  }
}
