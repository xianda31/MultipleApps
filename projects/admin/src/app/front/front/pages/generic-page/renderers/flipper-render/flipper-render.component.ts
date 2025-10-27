import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Snippet } from '../../../../../../common/interfaces/page_snippet.interface';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-flipper-render',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './flipper-render.component.html',
  styleUrls: ['./flipper-render.component.scss']
})
export class FlipperRenderComponent {
  @Input() snippets: Snippet[] = [];
  
  constructor(private sanitizer: DomSanitizer) { }
    FLIPPER_PERIOD = 10000; // ms
    ROTATION_DURATION = 4000; // ms

    CARD_STYLE : string = 'lateral'
    
  currentIndex: number = 0;
  flipperInterval: any;

  get rotationDurationSec(): string {
    return (this.ROTATION_DURATION / 1000) + 's';
  }


  trackById(index: number, item: any) {
    return item.id;
  }

  ngOnInit() {
    if (this.snippets.length > 1) {
      this.flipperInterval = setInterval(() => {
        this.currentIndex = (this.currentIndex + 1) % this.snippets.length;
      }, this.FLIPPER_PERIOD);
    }
  }

    stringToSafeHtml(htmlString: string) {
    return this.sanitizer.bypassSecurityTrustHtml(htmlString) ;
  }
}
