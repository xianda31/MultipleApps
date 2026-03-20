import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { BreakingNewsService, BreakingNewsMessage } from './breaking-news.service';

@Component({
  selector: 'app-breaking-news-display',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './breaking-news-display.component.html',
  styleUrls: ['./breaking-news-display.component.scss']
})
export class BreakingNewsDisplayComponent implements OnInit {

  readonly separator = '\u00a0\u00a0\u00a0\u00a0\u00a0\u2022\u00a0\u00a0\u00a0\u00a0\u00a0';

  visible$: Observable<boolean>;
  messages$: Observable<BreakingNewsMessage[]>;

  constructor(
    private breakingNewsService: BreakingNewsService
  )
     {
    this.visible$ = breakingNewsService.visible$;
    this.messages$ = breakingNewsService.messages$;
    
    // Debug logging
    this.visible$.subscribe(val => {
      console.log('[BreakingNewsDisplayComponent] visible$ changed to:', val);
    });
    this.messages$.subscribe(msgs => {
      console.log('[BreakingNewsDisplayComponent] messages$ changed to:', msgs);
    });
  }

  ngOnInit(): void {
    this.breakingNewsService.loadMessages();
  }

  getTickerText(messages: BreakingNewsMessage[]): string {
    const activeMessages = messages
      .filter(m => m.active)
      .map(m => m.text);
    
    return activeMessages.length > 0 
      ? activeMessages.join(this.separator)
      : '📢 Aucun message d\'information pour le moment.';
  }

  hasActiveMessages(messages: BreakingNewsMessage[]): boolean {
    return messages && messages.some(m => m.active);
  }
}

