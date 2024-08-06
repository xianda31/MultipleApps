import { JsonPipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FfbService } from '../ffb/services/ffb.service';
import { ffb_tournament } from '../ffb/interface/tournament.ffb.interface';

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [JsonPipe],
  templateUrl: './members.component.html',
  styleUrl: './members.component.scss'
})
export class MembersComponent implements OnInit {

  constructor(
    private ffbService: FfbService
  ) { }
  user!: any;
  tournaments!: ffb_tournament[];
  async ngOnInit(): Promise<void> {
    // this.httpClient.get('https://jsonplaceholder.typicode.com/users').subscribe((data) => {
    //   console.log("HttpClient called:", data);
    //   this.user = data;
    // });

    this.user = this.ffbService.getLicenceeDetails("renoux chr");
    this.tournaments = await this.ffbService.getTournaments();
  }

  // async getMemberDetails(search: string) {
  //   if (search === '') {
  //     return "";
  //   }

  //   try {
  //     const restOperation = get({
  //       apiName: 'myHttpApi',
  //       path: 'v1/search-members',
  //       options: {
  //         queryParams: { search: search }
  //       }
  //     });
  //     const { body } = await restOperation.response;
  //     // console.log('GET call succeeded: ', await body.text());
  //     const data = await body.json();
  //     return data;
  //   } catch (error) {
  //     console.log('GET call failed: ', error);
  //     return "";
  //   }
  // }


  // async getItem() {
  //   console.log('GET call initiated');
  //   try {
  //     const restOperation = get({
  //       apiName: 'myHttpApi',
  //       // path: 'members/207656',
  //       path: 'v1/search-members',
  //       options: {
  //         queryParams: { search: 'ducruc pie' }
  //       }

  //     });
  //     const { body } = await restOperation.response;

  //     console.log('GET call succeeded: ', await body.text());

  //   } catch (error) {
  //     console.log('GET call failed: ', error);
  //   }
  // }


}
