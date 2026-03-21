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
    if (spans.length < 2) return;

    const span0 = spans[0] as HTMLElement;
    const span1 = spans[1] as HTMLElement;

    // Reset du padding dynamique pour mesurer le texte seul
    span0.style.paddingRight = '';
    span1.style.paddingRight = '';

    const wrapperWidth = this.tickerContent.nativeElement.parentElement!.getBoundingClientRect().width;
    const rawTextWidth = span0.getBoundingClientRect().width;

    // Si le texte est plus court que le bandeau, span2 serait visible dès le départ.
    // On pad span1 pour que span2 commence exactement au bord droit du bandeau.
    if (rawTextWidth < wrapperWidth) {
      span0.style.paddingRight = `${wrapperWidth - rawTextWidth}px`;
    } else {
      span0.style.paddingRight = '4rem'; // séparateur visuel entre les répétitions
    }

    const spanWidth = span0.getBoundingClientRect().width;
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

