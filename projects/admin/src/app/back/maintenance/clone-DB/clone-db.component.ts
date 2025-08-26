import { Component } from '@angular/core';
import { BatchService } from '../SDK_v3.service';
import { DescribeTableOutput } from '@aws-sdk/client-dynamodb';
import { combineLatest, map, Observable, of, switchMap } from 'rxjs';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../environments/environment';


type Table = {
  name: string;
  itemCount: number;
  size: number;
};

@Component({
  selector: 'app-clone-db',
  imports: [CommonModule],
  templateUrl: './clone-db.component.html',
  styleUrl: './clone-db.component.scss'
})
export class CloneDBComponent {
  production_tables: DescribeTableOutput[] = [];
  sandbox_tables: DescribeTableOutput[] = [];
  started: boolean = false;
  production_apid = environment.production_apid;
  sandbox_apid = environment.sandbox_apid;
  source_table_description!: DescribeTableOutput | null;

  constructor(
    private batchService: BatchService
  ) { }


  async ngOnInit() {

    this.batchService.listTables().pipe(
      switchMap((tables) => {
        const descriptions: Observable<DescribeTableOutput>[] = tables.map((table) => {
          return this.batchService.describeTable(table);
        });
        return combineLatest(descriptions)
      }))
      .subscribe((tables) => {
        this.production_tables = tables.filter(table => this.apid(table.Table?.TableName ?? '') === this.production_apid);
        this.sandbox_tables = tables.filter(table => this.apid(table.Table?.TableName ?? '') === this.sandbox_apid);
      });

  }

  private apid(table_name: string) {
    const chunck = table_name.split('-');
    return chunck[1];
  }

  name(table_name: string): string {
    const chunck = table_name.split('-');
    return chunck[0];
  }


  cloneTable(source_table: string) {
    this.started = true;
    const destination_table = source_table.replace(this.production_apid, environment.sandbox_apid);
    console.log(`Cloning table ${source_table} to ${destination_table}`);


    // delete sandbox items

    console.log(`Deleting items from ${destination_table}`);
    this.batchService.scanTable(destination_table, 0).pipe(
      switchMap((items) => {
        if (items.length > 0) {
          return this.batchService.batchDeleteItem(destination_table, items);
        }
        return of([]); // No items to delete
      })
    ).subscribe({
      next: () => {
        console.log(`Items deleted from ${destination_table}`);
        this.copy_table(source_table, destination_table);
      },
      error: (error) => {
        console.error('Error deleting items:', error);
        this.started = false;
      }
    });

    // copy production items to sandbox

  }
copy_table(source_table: string, destination_table: string) {
    console.log(`Copying items from ${source_table} to ${destination_table}`);
    this.batchService.scanTable(source_table, 0).pipe(
      switchMap((items) => {
        if (items.length > 0) {
          return this.batchService.batchWriteItem(destination_table, items);
        }
        return of([]); // No items to copy
      })
    ).subscribe({
      next: () => {
        console.log(`Items copied from ${source_table} to ${destination_table}`);
        this.started = false;
      },
      error: (error) => {
        console.error('Error copying items:', error);
        this.started = false;
      }
    });
  }
}
