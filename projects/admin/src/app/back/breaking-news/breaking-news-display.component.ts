import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, Subscription } from 'rxjs';
import { BreakingNewsService, BreakingNewsMessage } from './breaking-news.service';

@Component({
  selector: 'app-breaking-news-display',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './breaking-news-display.component.html',
  styleUrls: ['./breaking-news-display.component.scss']
})
export class BreakingNewsDisplayComponent implements OnInit, AfterViewInit, OnDestroy {

  readonly separator = '\u00a0\u00a0\u00a0\u00a0\u00a0\u2022\u00a0\u00a0\u00a0\u00a0\u00a0';

  visible$: Observable<boolean>;
  messages$: Observable<BreakingNewsMessage[]>;

  @ViewChild('tickerContent') tickerContent!: ElementRef<HTMLElement>;
  private messagesSubscription!: Subscription;

  constructor(
    private breakingNewsService: BreakingNewsService
  ) {
    this.visible$ = breakingNewsService.visible$;
    this.messages$ = breakingNewsService.messages$;
  }

  ngOnInit(): void {
    this.breakingNewsService.loadMessages();
  }

  ngAfterViewInit(): void {
    // Recalcule la translation à chaque changement de messages
    this.messagesSubscription = this.messages$.subscribe(() => {
      // Attendre le prochain cycle de rendu
      setTimeout(() => this.updateTickerTranslation(), 50);
    });
  }

  ngOnDestroy(): void {
    this.messagesSubscription?.unsubscribe();
  }

  private readonly TICKER_SPEED_PX_PER_SEC = 60; // : 50 = lent, 80 = normal, 150 = rapide.

  private updateTickerTranslation(): void {
    if (!this.tickerContent) return;
    const spans = this.tickerContent.nativeElement.querySelectorAll('span');
    if (spans.length < 1) return;
    // La largeur exacte du premier span = distance à translater pour la boucle
    const spanWidth = (spans[0] as HTMLElement).offsetWidth;
    const duration = spanWidth / this.TICKER_SPEED_PX_PER_SEC;
    this.tickerContent.nativeElement.style.setProperty('--ticker-translate', `-${spanWidth}px`);
    this.tickerContent.nativeElement.style.animationDuration = `${duration}s`;
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

