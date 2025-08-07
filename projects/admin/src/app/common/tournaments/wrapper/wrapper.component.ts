import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-wrapper',
  standalone: true,
  imports: [],
  templateUrl: './wrapper.component.html',
  styleUrl: './wrapper.component.scss'
})
export class WrapperComponent implements OnInit {
  app: string = '';
  constructor(
    private router: ActivatedRoute,

  ) { }

  ngOnInit(): void {
    console.log('ngOnInit');
    this.router.data.subscribe(async data => {
      console.log('ngOnInit', data);
      let { app } = data;
      this.app = app;
    });
  }

}
