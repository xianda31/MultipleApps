import { Component } from '@angular/core';
import { BatchService } from '../SDK_v3.service';
import { DescribeTableOutput } from '@aws-sdk/client-dynamodb';
import { combineLatest, map, Observable, of, switchMap } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../common/services/toast.service';


type Table = {
  name: string;
  itemCount: number;
  size: number;
};

@Component({
  selector: 'app-clone-db',
  imports: [CommonModule, FormsModule],
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
  // UI selections and per-row cloning state
  selected: boolean[] = [];
  rowCloning: boolean[] = [];

  constructor(
    private batchService: BatchService,
    private toastService: ToastService
  ) { }


  async ngOnInit() {
    this.refreshTables();
  }

  refreshTables() {
    this.started = true;
    this.batchService.listTables().pipe(
      switchMap((tables) => {
        const descriptions: Observable<DescribeTableOutput>[] = tables.map((table) => {
          return this.batchService.describeTable(table);
        });
        return combineLatest(descriptions)
      }))
      .subscribe({
        next: (tables) => {
          this.production_tables = tables.filter(table => this.apid(table.Table?.TableName ?? '') === this.production_apid);
          this.sandbox_tables = tables.filter(table => this.apid(table.Table?.TableName ?? '') === this.sandbox_apid);
          // initialize selections and row states
          this.selected = this.production_tables.map(() => true);
          this.rowCloning = this.production_tables.map(() => false);
          this.started = false;
        },
        error: (_e) => {
          this.started = false;
          this.toastService.showErrorToast('Clone BDD', 'Erreur lors du chargement des tables');
        }
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


  cloneTableAt(index: number) {
    const source_table = this.production_tables[index].Table?.TableName ?? '';
    if (!source_table) return;
    const destination_table = source_table.replace(this.production_apid, environment.sandbox_apid);
    this.started = true;
    this.rowCloning[index] = true;
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
        this.copy_table(index, source_table, destination_table);
      },
      error: (error) => {
        console.error('Error deleting items:', error);
        this.finishRow(index);
      }
    });

    // copy production items to sandbox

  }
  copy_table(index: number, source_table: string, destination_table: string) {
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
        // Post-clone validation: compare item counts via paginated scans
        this.validateCounts(index, source_table, destination_table);
      },
      error: (error) => {
        console.error('Error copying items:', error);
        this.toastService.showErrorToast('Clone BDD', `Erreur lors du clonage de la table ${this.name(source_table)}`);
        this.finishRow(index);
      }
    });
  }

  private validateCounts(index: number, source_table: string, destination_table: string) {
    // Run scans in sequence to reduce pressure
    this.batchService.scanTable(source_table, 0).pipe(
      switchMap((srcItems) => this.batchService.scanTable(destination_table, 0).pipe(map(destItems => ({ src: srcItems, dest: destItems }))))
    ).subscribe({
      next: ({ src, dest }) => {
        const srcCount = src.length;
        const destCount = dest.length;
        // Update UI counts to reflect live scan results (DescribeTable ItemCount is eventually consistent)
        if (this.production_tables[index]?.Table) {
          this.production_tables[index].Table!.ItemCount = srcCount;
        }
        if (this.sandbox_tables[index]?.Table) {
          this.sandbox_tables[index].Table!.ItemCount = destCount;
        }
        if (srcCount === destCount) {
          this.toastService.showSuccess('Clone BDD', `Table ${this.name(source_table)} clonée et vérifiée (${srcCount} items).`);
        } else {
          this.toastService.showWarning('Clone BDD', `Clonage terminé mais écart détecté: source=${srcCount}, dest=${destCount}.`);
        }
        this.finishRow(index);
      },
      error: (_e) => {
        this.toastService.showWarning('Clone BDD', `Clonage terminé, mais la validation a échoué pour ${this.name(source_table)}.`);
        this.finishRow(index);
      }
    });
  }

  async cloneSelected() {
    const indices = this.selected
      .map((v, i) => ({ v, i }))
      .filter(e => e.v)
      .map(e => e.i);
    if (indices.length === 0) {
      this.toastService.showInfo('Clone BDD', 'Aucune table sélectionnée');
      return;
    }
    this.started = true;
    // Démarre les clones en parallèle (chaque ligne gère son propre état)
    for (const i of indices) {
      this.cloneTableAt(i);
    }
    // Surveille la fin de tous les clones sélectionnés, puis lance un rafraîchissement live global
    const selectedSet = new Set(indices);
    const timer = setInterval(() => {
      const allDone = indices.every(i => this.rowCloning[i] === false);
      if (allDone) {
        clearInterval(timer);
        this.refreshCountsLive();
      }
    }, 1000);
  }

  private finishRow(index: number) {
    this.rowCloning[index] = false;
    // Si plus aucune ligne n'est en cours et pas de batch en attente, libère l'UI
    if (this.rowCloning.every(v => v === false)) {
      this.started = false;
    }
  }

  // Live refresh of item counts using strong-consistency scans
  refreshCountsLive() {
    this.started = true;
    const prodScans = this.production_tables.map(t => {
      const name = t.Table?.TableName ?? '';
      return this.batchService.scanTable(name, 0).pipe(map(items => items.length));
    });
    const sandScans = this.sandbox_tables.map(t => {
      const name = t.Table?.TableName ?? '';
      return this.batchService.scanTable(name, 0).pipe(map(items => items.length));
    });

    const prod$ = prodScans.length ? combineLatest(prodScans) : of([] as number[]);
    const sand$ = sandScans.length ? combineLatest(sandScans) : of([] as number[]);

    combineLatest([prod$, sand$]).subscribe({
      next: ([prodCounts, sandCounts]) => {
        for (let i = 0; i < prodCounts.length; i++) {
          if (this.production_tables[i]?.Table) {
            this.production_tables[i].Table!.ItemCount = prodCounts[i];
          }
        }
        for (let i = 0; i < sandCounts.length; i++) {
          if (this.sandbox_tables[i]?.Table) {
            this.sandbox_tables[i].Table!.ItemCount = sandCounts[i];
          }
        }
        this.toastService.showInfo('Clone BDD', 'Comptes mis à jour (live)');
        this.started = false;
      },
      error: (_e) => {
        this.toastService.showErrorToast('Clone BDD', 'Échec du rafraîchissement (live)');
        this.started = false;
      }
    });
  }
}
