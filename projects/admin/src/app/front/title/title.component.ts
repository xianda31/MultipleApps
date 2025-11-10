import { Component } from '@angular/core';
import { TitleService } from './title.service';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-title',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './title.component.html',
  styleUrl: './title.component.scss'
})
export class TitleComponent {
  title$!: Observable<string>;

  // Inject the TitleService to get the title
  constructor(
    private titleService: TitleService
  ) { }

  ngOnInit(): void {
    this.title$ = this.titleService.Title$;
    this.title$.subscribe(title => {
    });
  }

}
