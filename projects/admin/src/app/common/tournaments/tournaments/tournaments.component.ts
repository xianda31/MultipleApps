import { CommonModule } from '@angular/common';
import { Component, HostListener, Input } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TournamentService } from '../../services/tournament.service';
import { TournamentTeams, Tournament } from '../../ffb/interface/tournament.interface';
import { AuthentificationService } from '../../authentification/authentification.service';
import { TitleService } from '../../../front/title/title.service';
import { BreakpointsSettings } from '../../interfaces/ui-conf.interface';
import { formatRowColsClasses } from '../../utils/ui-utils';
import { SystemDataService } from '../../services/system-data.service';
import { catchError, combineLatest, filter, forkJoin, map, merge, of, scan, startWith, switchMap, take } from 'rxjs';
import { Member } from '../../interfaces/member.interface';
import { isFemaleGender } from '../../utils/gender.util';

const MAX_TOURNAMENTS_LISTED = 9;
const DEFAULT_ROW_COLS: BreakpointsSettings = { SM: 1, MD: 2, LG: 3, XL: 4 };

@Component({
  selector: 'app-tournaments',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './tournaments.component.html',
  styleUrls: ['./tournaments.component.scss']
})
export class TournamentsComponent {
  @Input() displayTitle: boolean = true;
  private _rowCols: BreakpointsSettings = DEFAULT_ROW_COLS;

  @Input()
  set row_cols(value: BreakpointsSettings | null | undefined) {
    this._rowCols = value ?? DEFAULT_ROW_COLS;
  }

  get row_cols(): BreakpointsSettings {
    return this._rowCols;
  }


  next_tournament_teams: TournamentTeams[] = [];

  person_id: number | null | undefined; // Person ID of the logged member
  // logged: boolean = false;
  loading: boolean = true;
  in_error: boolean = false;
  logged: Member | null = null;
  private tournamentTypeUrls: { [key: string]: string | null } = {};
  private isolatedTournamentIds = new Set<number>();



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
        const initialTeams = nextTournaments.map(tournament => this.deserializeTournament(tournament));
        if (!member || initialTeams.length === 0) {
          return of({ teams: initialTeams, completed: initialTeams.length, total: initialTeams.length });
        }

        return merge(...nextTournaments.map((tournament, index) =>
          this.tournamentService.getTournamentTeams(tournament.id.toString()).pipe(
            map(team => ({ index, team })),
            catchError(error => {
              console.warn(`[TournamentsComponent] Teams unavailable for tournament ${tournament.id}`, error);
              return of({ index, team: initialTeams[index] });
            })
          )
        )).pipe(
          scan((state, update) => {
            const teams = [...state.teams];
            teams[update.index] = update.team;
            return { teams, completed: state.completed + 1, total: initialTeams.length };
          }, { teams: initialTeams, completed: 0, total: initialTeams.length }),
          startWith({ teams: initialTeams, completed: 0, total: initialTeams.length })
        );
      })
    ).subscribe({
      next: ({ teams, completed, total }) => {
        this.next_tournament_teams = this.enrichWithImages(teams);
        this.loading = false;
        if (completed === total) {
          this.loadIsolatedRegistrations(this.next_tournament_teams);
        }
      },
      error: (err) => {
        this.loading = false;
        this.in_error = true;
        console.error('Erreur lors du chargement des tournois :', err);
      }
    });
  }

  private loadIsolatedRegistrations(tournaments: TournamentTeams[]): void {
    this.isolatedTournamentIds.clear();
    if (this.person_id === undefined || this.person_id === null) {
      return;
    }

    const candidates = tournaments.filter((tournament) => this.getIsolatedPlayerCount(tournament) > 0);
    if (candidates.length === 0) {
      return;
    }

    forkJoin(candidates.map((tournament) =>
      this.tournamentService.getIsolatedPlayers(tournament.tournament.id.toString()).pipe(
        map((response) => ({
          tournamentId: tournament.tournament.id,
          registered: response.items.some((entry) => entry.person.id === this.person_id)
        })),
        catchError(() => of({ tournamentId: tournament.tournament.id, registered: false }))
      )
    )).subscribe((registrations) => {
      this.isolatedTournamentIds = new Set(
        registrations.filter((registration) => registration.registered).map((registration) => registration.tournamentId)
      );
    });
  }

  private enrichWithImages(tournamentTeams: TournamentTeams[]): TournamentTeams[] {
    return tournamentTeams.map((team) => {
      const rawName = team.tournament.title || '';
      const nameKey = rawName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const imageUrl = this.findImageUrlForName(nameKey, this.tournamentTypeUrls);
      return Object.assign(team as any, { image_url: imageUrl });
    });
  }

  private deserializeTournament(tournament: Tournament): TournamentTeams {
    return {
      tournament,
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
    return tTeams.tournament.date;
  }
  time_of(tTeams: TournamentTeams): string {
    const date = new Date(tTeams.tournament.date);
    return Number.isNaN(date.getTime())
      ? ''
      : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
  name_of(tTeams: TournamentTeams): string {
    return tTeams.tournament.title;
  }
  ivPlayerMax_of(tTeams: TournamentTeams): number | undefined {
    return tTeams.tournament.ivPlayerMax;
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

  isolated_in(tTeams: TournamentTeams): boolean {
    return !this.registrated_in(tTeams) && this.isolatedTournamentIds.has(tTeams.tournament.id);
  }

  isLoggedFemale(): boolean {
    return isFemaleGender(this.logged?.gender);
  }

  getIsolatedPlayerCount(tournament: TournamentTeams): number {
    const count = tournament.tournament.isolatedPlayerCount;
    if (count !== undefined) {
      return count;
    }
    return 0;
  }

  getPairedTeamCount(tournament: TournamentTeams): number {
    return tournament.tournament.entryCount;
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
    let cols: number;
    if (w >= 1200 && bp.XL != null) cols = bp.XL;
    else if (w >= 992 && bp.LG != null) cols = bp.LG;
    else if (w >= 768 && bp.MD != null) cols = bp.MD;
    else if (w >= 576 && bp.SM != null) cols = bp.SM;
    else cols = 1;
    return { 'grid-template-columns': `repeat(${cols}, 1fr)` };
  }

}
