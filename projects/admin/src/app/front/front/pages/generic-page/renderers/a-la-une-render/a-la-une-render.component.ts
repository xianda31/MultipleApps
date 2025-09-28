import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Snippet } from '../../../../../../common/interfaces/page_snippet.interface';
import { Router } from '@angular/router';
import { TruncatePipe } from '../../../../../../common/pipes/truncate.pipe';

@Component({
  selector: 'app-a-la-une-render',
  standalone: true,
  imports: [CommonModule, TruncatePipe],
  templateUrl: './a-la-une-render.component.html',
  styleUrls: ['./a-la-une-render.component.scss']
})
export class ALaUneRenderComponent implements OnChanges {
  @Input() snippets: Snippet[] = [];
  @Input() selected_title?: string; // for news, the title of the selected snippet

  read_more: boolean = true;
  TRUNCATE_LIMIT = 300; //  truncating news content
  TRUNCATE_HYSTERISIS = 50; // threshold to show "Read more" link
  constructor(
    private router: Router,

  ) { }


   ngOnChanges(changes: SimpleChanges): void {
 
    if (changes['selected_title'] ) {
      // Scroll to the snippet if selected_title changes
      const snippet = this.snippets.find(s => s.title === this.selected_title);
      if (snippet) {
        console.log('Scrolling to snippet:', snippet.title);
        this.read_more = false
        this.scrollToElement(snippet.title);
      }
    }else{
      this.read_more = true;
    }
  }

  trackById(index: number, item: any) {
    return item.id;
  }

  readMore(snippet: Snippet) {
    this.router.navigate(['/front/news', snippet.title]);
  }

  scrollToElement(title: string): void {
    // Assumes each snippet element has an id or attribute based on its title
    const element = document.getElementById(title);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

}
