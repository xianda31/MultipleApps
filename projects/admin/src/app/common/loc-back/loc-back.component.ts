import { CommonModule , Location} from '@angular/common';
import { Component } from '@angular/core';

@Component({
    selector: 'loc-back',
    imports: [CommonModule],
    templateUrl: './loc-back.component.html',
    styleUrl: './loc-back.component.scss'
})
export class BackComponent {
 constructor(
    private location: Location
  ) { }

  back_to_parent_page() {
    this.location.back();
  }
}
