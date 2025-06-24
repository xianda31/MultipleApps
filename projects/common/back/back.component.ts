import { CommonModule , Location} from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'back',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './back.component.html',
  styleUrl: './back.component.scss'
})
export class BackComponent {
 constructor(
    private location: Location
  ) { }

  back_to_parent_page() {
    this.location.back();
  }
}
