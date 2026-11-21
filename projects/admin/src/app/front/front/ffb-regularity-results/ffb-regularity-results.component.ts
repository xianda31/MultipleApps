import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FFB_proxyService } from '../../../common/ffb/services/ffb.service';

@Component({
  selector: 'app-ffb-regularity-results',
  template: `
    @if (safeUrl) {
      <iframe [src]="safeUrl" title="Résultats FFB de régularité" width="100%"
        style="border:1px solid #ccc; border-radius:8px; background:#fff;"></iframe>
    } @else if (error) {
      <div class="alert alert-warning" role="alert">Impossible de charger les résultats FFB de la saison courante. Veuillez réessayer ultérieurement.</div>
    } @else {
      <p>Chargement des résultats FFB...</p>
    }
  `,
  styles: [`
    iframe {
      display: block;
      height: max(320px, calc(100dvh - 8rem));
    }

    :host-context(.laptop-main-shell) iframe {
      height: max(400px, calc(100dvh - 8rem));
    }
  `],
})
export class FfbRegularityResultsComponent implements OnInit {
  safeUrl: SafeResourceUrl | null = null;
  error = false;

  constructor(
    private ffbService: FFB_proxyService,
    private sanitizer: DomSanitizer,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const season = await this.ffbService.getCurrentSeason();
      if (!season) {
        throw new Error('Saison courante FFB indisponible');
      }
      const groupId = await this.ffbService.getClubRegularityResultsGroup(season.id);
      const params = new URLSearchParams({ season: String(season.id), page: '1', itemsPerPage: '50' });
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
        `https://www.ffbridge.fr/competitions/results/groups/${groupId}?${params.toString()}`,
      );
    } catch (error) {
      console.error('[Résultats FFB] Chargement impossible', error);
      this.error = true;
    }
  }
}
