import { Component } from '@angular/core';
import { TitleService } from '../../../title/title.service';
import { GenericPageComponent } from '../generic-page/generic-page.component';
import { TournamentsComponent } from '../../../../common/tournaments/tournaments/tournaments.component';
import { Router, ActivatedRoute } from '@angular/router';
import { EXTRA_TITLES, MENU_TITLES } from '../../../../common/interfaces/page_snippet.interface';
import { MembersService } from '../../../../common/services/members.service';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { combineLatest, map, Observable, switchMap, tap, interval, Subscription } from 'rxjs';
import { Member } from '../../../../common/interfaces/member.interface';
import { AuthentificationService } from '../../../../common/authentification/authentification.service';
import { CommonModule } from '@angular/common';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { FileService, S3_ROOT_FOLDERS } from '../../../../common/services/files.service';
import { S3Item } from '../../../../common/interfaces/file.interface';

@Component({
  selector: 'app-home-page',
  imports: [CommonModule,GenericPageComponent, TournamentsComponent],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss'
})
export class HomePage {
  EXTRA_TITLES = EXTRA_TITLES;
  MENU_TITLES = MENU_TITLES;
  licensees = 0;
  logged_member$: Observable<Member | null> = new Observable<Member | null>();
  isMdOrAbove: boolean = false;
  home_folder: string = 'images/accueil';
  photos: string[] = ['/marcaissonne.jpg'];
  photo_index: number = 0;
  // Holds the upcoming index used for the top layers during transition to avoid flash
  next_index: number = 0;
  photo_count: number = 1;
  readonly ROTATION_TIME = 8000; // ms between rotations
  readonly FADE_OUT_MS = 1500;      // sequential fade-out duration
  // readonly FADE_IN_MS = 1500;       // sequential fade-in duration
  private rotationSub?: Subscription;
  transitioning = false; // legacy flag (unused in sequential fade)
  opacity = 1;           // controls sequential fade opacity

  constructor(
    private titleService: TitleService,
    private router: Router,
    private route: ActivatedRoute,
    private membersService: MembersService,
    private systemDataService: SystemDataService,
    private auth: AuthentificationService,
    private breakpointObserver: BreakpointObserver,
    private fileService: FileService,
  ) {
    this.breakpointObserver.observe([Breakpoints.Medium, Breakpoints.Large, Breakpoints.XLarge])
      .subscribe(result => {
        this.isMdOrAbove = result.matches;
      });
  }
  ngOnInit(): void {
    this.logged_member$ = this.auth.logged_member$;

    this.titleService.setTitle('Accueil');
    const season = this.systemDataService.get_today_season();

    this.membersService.listMembers().subscribe((members) => {
      this.licensees = members.filter(m => m.season === season).length;
      // this.sympathisants = members.filter(m => (m.is_sympathisant === true) && (m.season === season)).length;
    });

      this.fileService.list_files(this.home_folder + '/').pipe(
        map((S3items) => S3items.filter(item => item.size !== 0)),
        tap((items) => {if(items.length === 0) console.warn('Album %s is empty');}),
        switchMap((S3items) => {
          return combineLatest(
            S3items.map(item => this.fileService.getPresignedUrl$((item.path)))
          )
        })
      ).subscribe((items) => { 
         this.photos.push(...items);
         this.photo_count = this.photos.length;
         // prepare next index once photos are known
         this.next_index = (this.photo_index + 1) % this.photo_count;
        console.log('Home photos loaded', this.photos.length);
      });

    // start slideshow rotation with sequential fade (out then in)
    this.rotationSub = interval(this.ROTATION_TIME).subscribe(() => {
      if (this.photo_count <= 1) return;
      // compute and preload next image
      const next = (this.photo_index + 1) % this.photo_count;
      this.next_index = next;
      try {
        const img = new Image();
        img.decoding = 'async';
        img.loading = 'eager' as any;
        img.src = this.photos[next];
      } catch {}
      // fade out current image
      this.opacity = 0;
      setTimeout(() => {
        // swap image when fully transparent
        this.photo_index = next;
        // fade back in on next frame to ensure src swap is applied
        requestAnimationFrame(() => {
          this.opacity = 1;
        });
      }, this.FADE_OUT_MS);
    });
  }


  onTournamentSelected(tournamentId: number) {
    this.router.navigate(['/front/tournaments', tournamentId],
      { relativeTo: this.route });
  }

  goToNews(event: Event) {
    event.preventDefault();
    this.router.navigate(['/front/news']);
  }

  ngOnDestroy(): void {
    this.rotationSub?.unsubscribe();
  }
}