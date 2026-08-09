import { CommonModule } from '@angular/common';
import { Component, HostListener, Input } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TournamentService } from '../../services/tournament.service';
import { TournamentTeams } from '../../ffb/interface/tournament_teams.interface';
import { AuthentificationService } from '../../authentification/authentification.service';
import { TitleService } from '../../../front/title/title.service';
import { BreakpointsSettings } from '../../interfaces/ui-conf.interface';
import { formatRowColsClasses } from '../../utils/ui-utils';
import { SystemDataService } from '../../services/system-data.service';
import { combineLatest, filter, forkJoin, map, of, switchMap, take } from 'rxjs';
import { Member } from '../../interfaces/member.interface';
import { isFemaleGender } from '../../utils/gender.util';
import { TournamentV2 } from '../../ffb/interface/tournament-v2.interface';

const MAX_TOURNAMENTS_LISTED = 8;

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

  person_id: number | null | undefined; // Person ID of the logged member
  // logged: boolean = false;
  loading: boolean = true;
  in_error: boolean = false;
  logged: Member | null = null;
  private tournamentTypeUrls: { [key: string]: string | null } = {};



  constructor(
    private tournamentService: TournamentService,
    private auth: AuthentificationService,
    private router: Router,
    private route: ActivatedRoute,
    private titleService: TitleService,
    private systemDataService: SystemDataService,

  ) { }



  ngOnInit(): void {


    if (this.displayTitle !== false) this.titleService.setTitle('Les prochains tournois de régularité');
    this.loadTournamentImages();
    this.loadTournamentTeams();
  }

  private loadTournamentImages(): void {
    this.systemDataService.tournamentsTypeWithUrl$().pipe(take(1)).subscribe({
      next: (typesMap) => {
        this.tournamentTypeUrls = typesMap || {};
        this.next_tournament_teams = this.enrichWithImages(this.next_tournament_teams);
      },
      error: (error) => console.warn('[TournamentsComponent] Tournament images unavailable', error)
    });
  }

  loadTournamentTeams() {
    this.loading = true;
    combineLatest([
      this.tournamentService.list_next_tournaments(0),
      combineLatest([
        this.auth.isRestoringSession$,
        this.auth.logged_member$
      ]).pipe(
        filter(([isRestoring]) => !isRestoring),
        map(([, member]) => member)
      )
    ]).pipe(
      switchMap(([tournaments, member]) => {
        this.person_id = member?.person_id;
        this.logged = member;

        const nextTournaments = [...tournaments]
          .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
          .slice(0, MAX_TOURNAMENTS_LISTED);
        if (!member || nextTournaments.length === 0) {
          return of(nextTournaments.map(tournament => this.deserializeTournament(tournament)));
        }
        return forkJoin(
          nextTournaments.map((tournament) =>
            this.tournamentService.getTournamentTeams(tournament.id.toString())
          )
        );
      })
    ).subscribe({
      next: (nextTournamentTeams) => {
        this.next_tournament_teams = this.enrichWithImages(nextTournamentTeams);
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.in_error = true;
        console.error('Erreur lors du chargement des tournois :', err);
      }
    });
  }

  private enrichWithImages(tournamentTeams: TournamentTeams[]): TournamentTeams[] {
    return tournamentTeams.map((team) => {
      const rawName = team.subscription_tournament.organization_club_tournament.tournament_name || '';
      const nameKey = rawName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const imageUrl = this.findImageUrlForName(nameKey, this.tournamentTypeUrls);
      return Object.assign(team as any, { image_url: imageUrl });
    });
  }

  private deserializeTournament(tournament: TournamentV2): TournamentTeams {
    const parsedDate = new Date(tournament.date);
    const time = Number.isNaN(parsedDate.getTime())
      ? ''
      : `${String(parsedDate.getHours()).padStart(2, '0')}:${String(parsedDate.getMinutes()).padStart(2, '0')}`;

    return {
      subscription_tournament: {
        id: tournament.id,
        organization_club_tournament: {
          date: tournament.date,
          tournament_name: tournament.title,
          session_name: tournament.title,
          time,
          entryCount: tournament.entryCount,
          isolatedPlayerCount: tournament.isolatedPlayerCount,
          ivPlayerMax: tournament.ivPlayerMax,
        }
      },
      items: []
    };
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
  time_of(tTeams: TournamentTeams): string {
    return tTeams.subscription_tournament.organization_club_tournament.time;
  }
  name_of(tTeams: TournamentTeams): string {
    return tTeams.subscription_tournament.organization_club_tournament.tournament_name;
  }
  ivPlayerMax_of(tTeams: TournamentTeams): number | undefined {
    return tTeams.subscription_tournament.organization_club_tournament.ivPlayerMax;
  }


  getImageUrl(tTeams: TournamentTeams): string | null {
    return (tTeams as any).image_url ?? null;
  }



  registrated_in(tTeams: TournamentTeams): boolean {

    if (this.person_id === undefined || this.person_id === null) {
      return false; // If not logged or person_id not set, return false
    }
    for (let team of tTeams.items) {
      const playerId1 = team.players[0]?.id;
      const playerId2 = team.players[1]?.id;
      if ((playerId1 === this.person_id) || (playerId2 === this.person_id)) {
        return true;
      }
    }
    return false;
  }

  isLoggedFemale(): boolean {
    return isFemaleGender(this.logged?.gender);
  }

  getIsolatedPlayerCount(tournament: TournamentTeams): number {
    const apiCount = tournament.subscription_tournament.organization_club_tournament.isolatedPlayerCount;
    if (apiCount !== undefined) {
      return apiCount;
    }
    return tournament.items.filter(team => team.players.length === 1).length;
  }

  getPairedTeamCount(tournament: TournamentTeams): number {
    const entryCount = tournament.subscription_tournament.organization_club_tournament.entryCount;
    return Math.max(0, entryCount - this.getIsolatedPlayerCount(tournament));
  }

  selectTournament(tournamentId: number) {
    this.router.navigate(['.', tournamentId],
      { relativeTo: this.route });
  }

  // Compute bootstrap row classes from the `row_cols` input (breakpoints settings).
  rowCols(): string[] {
    return formatRowColsClasses(this.row_cols);
  }

  @HostListener('window:resize')
  onResize(): void { /* déclenche la réévaluation de gridStyle() */ }

  gridStyle(): { [key: string]: string } {
    const w = window.innerWidth;
    const bp = this.row_cols;
    if (!bp) {
      console.warn('[TournamentsComponent] row_cols is undefined — composant instancié sans parent (accès direct par routeur ?). Utilisation des valeurs par défaut.');
    }
    const safeBp = bp ?? { SM: 1, MD: 2, LG: 3, XL: 4 };
    let cols: number;
    if (w >= 1200 && safeBp.XL != null) cols = safeBp.XL;
    else if (w >= 992 && safeBp.LG != null) cols = safeBp.LG;
    else if (w >= 768 && safeBp.MD != null) cols = safeBp.MD;
    else if (w >= 576 && safeBp.SM != null) cols = safeBp.SM;
    else cols = 1;
    return { 'grid-template-columns': `repeat(${cols}, 1fr)` };
  }

}
