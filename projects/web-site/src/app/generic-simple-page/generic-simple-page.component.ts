import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-generic-simple-page',
  standalone: true,
  imports: [],
  templateUrl: './generic-simple-page.component.html',
  styleUrl: './generic-simple-page.component.scss'
})
export class GenericSimplePageComponent {
  pageId!: string;
  constructor(
    private router: ActivatedRoute,
  ) {
    this.router.data.subscribe(data => {
      let { pageId } = data;
      this.pageId = pageId;
    });
  }

}
