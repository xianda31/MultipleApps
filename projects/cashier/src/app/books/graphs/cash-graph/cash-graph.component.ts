import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Color, NgxChartsModule, ScaleType } from '@swimlane/ngx-charts';
import { data } from '../../../../../../../amplify/data/resource';

interface Point  {
  name: string;
  value: number;
}
type Serie = Point[];

@Component({
  selector: 'app-cash-graph',
  standalone: true,
  imports: [CommonModule, NgxChartsModule],
  templateUrl: './cash-graph.component.html',
  styleUrl: './cash-graph.component.scss'
})


export class CashGraphComponent {

@Input() serie: Serie = [];
view: [number, number] = [1200, 300];
multi: { name: string; series: Serie }[] = [];
// options
legend: boolean = false;
showLabels: boolean = true;
animations: boolean = true;
xAxis: boolean = true;
yAxis: boolean = true;
showYAxisLabel: boolean = false;
showXAxisLabel: boolean = false;
xAxisLabel: string = "Year";
yAxisLabel: string = "Population";
timeline: boolean = true;

colorScheme : Color = {
  domain: ['#5AA454', '#A10A28', '#C7B42C', '#AAAAAA'],
  name: 'customScheme',
  selectable: true,
  group: ScaleType.Ordinal
};

constructor() {
}

ngOnInit() {
  console.log("CashGraphComponent ngOnInit called", this.serie.length);
  this.multi.push({name:"caisse", series:this.serie});
  // Object.assign(this, { multi: this.multi });
}


onSelect(data: any): void {
  console.log("Item clicked", JSON.parse(JSON.stringify(data)));
}

onActivate(data: any): void {
  console.log("Activate", JSON.parse(JSON.stringify(data)));
}

onDeactivate(data: any): void {
  console.log("Deactivate", JSON.parse(JSON.stringify(data)));
}

}
