import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TournamentService } from '../../services/tournament.service';
import { TournamentTeams } from '../../ffb/interface/tournament_teams.interface';
import { AuthentificationService } from '../../authentification/authentification.service';
import { TitleService } from '../../../front/title/title.service';
import { BreakpointsSettings } from '../../interfaces/ui-conf.interface';
import { formatRowColsClasses } from '../../utils/ui-utils';
import { SystemDataService } from '../../services/system-data.service';
import { combineLatest } from 'rxjs';

@Component({
  selector: 'app-tournaments',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './tournaments.component.html',
  styleUrls: ['./tournaments.component.scss']
})
export class TournamentsComponent {
  @Input() displayTitle: boolean = true;
  @Input() row_cols: BreakpointsSettings = { SM: 1, MD: 2, LG: 3, XL: 4 };


  next_tournament_teams: TournamentTeams[] = [];

  license_nbr = 0; // License number of the logged member
  logged: boolean = false;

  

  constructor(
    private tournamentService: TournamentService,
    private auth: AuthentificationService,
    private router: Router,
    private route: ActivatedRoute,
    private titleService: TitleService,
    private systemDataService: SystemDataService

  ) { }



  ngOnInit(): void {


    if (this.displayTitle) this.titleService.setTitle('Les prochains tournois de régularité');
    this.loadTournamentTeams();

    this.auth.logged_member$.subscribe((member) => {
      const whoAmI = member;
      this.license_nbr = whoAmI ? Number(whoAmI.license_number) : 0;
      this.logged = !!whoAmI;
    });
  }


  loadTournamentTeams() {
    combineLatest([
      this.systemDataService.tournamentsTypeWithUrl$(),
      this.tournamentService.list_next_tournament_teams()
    ]).subscribe(([types_map, next_tournament_teams]: [any, TournamentTeams[]]) => {
      const mapObj = types_map || {};

      // Enrich each team with a precomputed `image_url` using a helper for clarity.
      const enrichedTeams = next_tournament_teams.map((team) => {
        const rawName = team.subscription_tournament.organization_club_tournament.tournament_name || '';
        const nameKey = rawName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const imageUrl = this.findImageUrlForName(nameKey, mapObj);
        return Object.assign(team as any, { image_url: imageUrl });
      });

      this.next_tournament_teams = enrichedTeams;
    });
  }

  private findImageUrlForName(nameKey: string, mapObj: any): string | null {
    if (!mapObj) return null;
    for (const [k, url] of Object.entries(mapObj)) {
      const nk = String(k || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (!nk) continue;
      if (!nameKey.includes(nk)) continue;
      if (typeof url === 'string') return url;
      if (url && typeof (url as any).url === 'string') return (url as any).url;
      if (url && typeof (url as any).presigned_url === 'string') return (url as any).presigned_url;
    }
    // If no specific match found, try known default keys in the ui config mapping
    const defaultKeys = ['defaut', 'défaut', 'default', '__default__', 'fallback'];
    for (const dk of defaultKeys) {
      const v = (mapObj as any)[dk];
      if (!v) continue;
      if (typeof v === 'string') return v;
      if (v && typeof (v as any).url === 'string') return (v as any).url;
      if (v && typeof (v as any).presigned_url === 'string') return (v as any).presigned_url;
    }
    return null;
  }

  date_of(tTeams: TournamentTeams): string {
    return tTeams.subscription_tournament.organization_club_tournament.date;
  }
  name_of(tTeams: TournamentTeams): string {
    return tTeams.subscription_tournament.organization_club_tournament.tournament_name;
  }
  

  // Template-friendly getter to avoid template type-check/casting issues.
  getImageUrl(tTeams: TournamentTeams): string | null {
    return (tTeams as any).image_url ?? null;
  }


  icon_for(tTeams: TournamentTeams): string {
    const _name = tTeams.subscription_tournament.organization_club_tournament.tournament_name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
    if (_name.includes('roy')) return 'bi bi-award';
    if (_name.includes('eleve')) return 'bi bi-mortarboard-fill';
    if (_name.includes('accession')) return 'bi bi-mortarboard-fill';
    if (_name.includes('regularite')) return 'bi bi-gear-fill';
    if (_name.includes('coupe')) return 'bi bi-trophy-fill';
    return '';
  }

  registrated_in(tTeams: TournamentTeams): boolean {

    if (!this.license_nbr) {
      return false; // If no license number is set, return false
    }
    for (let team of tTeams.teams) {
      if ((team.players[0].person.license_number === this.license_nbr)
        || (team.players[1]?.person.license_number === this.license_nbr)) {
        return true;
      }
    }
    return false;
  }

  selectTournament(tournamentId: number) {
    this.router.navigate(['/front/tournaments', tournamentId],
      { relativeTo: this.route });
  }

  // Compute bootstrap row classes from the `row_cols` input (breakpoints settings).
  rowCols(): string[] {
    return formatRowColsClasses(this.row_cols);
  }

}
