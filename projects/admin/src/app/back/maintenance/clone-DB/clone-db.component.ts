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

type TableRow = {
  name: string; // nom sans apid (ex: "BookEntry")
  production?: DescribeTableOutput;
  sandbox?: DescribeTableOutput;
};

@Component({
  selector: 'app-clone-db',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './clone-db.component.html',
  styleUrl: './clone-db.component.scss'
})
export class CloneDBComponent {
  production_tables: DescribeTableOutput[] = [];
  sandbox_tables: DescribeTableOutput[] = [];
  tableRows: TableRow[] = [];
  started: boolean = false;
  production_apid = environment.production_apid;
  sandbox_apid = environment.sandbox_apid;
  source_table_description!: DescribeTableOutput | null;
  // UI selections and per-row cloning state
  selected: Map<string, boolean> = new Map(); // clé: tableName (sans apid)
  rowCloning: Map<string, boolean> = new Map();
  reverseDirection: boolean = false; // Si true, clone de sandbox vers production

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
          
          // Build table mapping by name (without apid)
          const tableMap = new Map<string, TableRow>();
          
          // Add production tables
          this.production_tables.forEach((table) => {
            const tableName = table.Table?.TableName ?? '';
            const name = this.name(tableName);
            if (!tableMap.has(name)) {
              tableMap.set(name, { name });
            }
            tableMap.get(name)!.production = table;
          });
          
          // Add sandbox tables
          this.sandbox_tables.forEach((table) => {
            const tableName = table.Table?.TableName ?? '';
            const name = this.name(tableName);
            if (!tableMap.has(name)) {
              tableMap.set(name, { name });
            }
            tableMap.get(name)!.sandbox = table;
          });
          
          // Sort and convert to array
          this.tableRows = Array.from(tableMap.values()).sort((a, b) => a.name.localeCompare(b.name));
          
          // Initialize selections and row cloning state
          this.selected.clear();
          this.rowCloning.clear();
          this.tableRows.forEach((row) => {
            this.selected.set(row.name, true);
            this.rowCloning.set(row.name, false);
          });
          
          this.started = false;
        },
        error: (_e) => {
          this.started = false;
          this.toastService.showError('Clone BDD', 'Erreur lors du chargement des tables');
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


  cloneTableAt(tableName: string) {
    // Find the row for this table name
    const row = this.tableRows.find(r => r.name === tableName);
    if (!row || (!row.production && !row.sandbox)) {
      console.error(`Invalid table name ${tableName}: missing table definition`);
      this.toastService.showError('Clone BDD', `Table ${tableName} non trouvée.`);
      return;
    }

    let source_table: string;
    let destination_table: string;
    
    if (this.reverseDirection) {
      // Mode DANGEREUX : sandbox → production
      if (!row.sandbox || !row.production) {
        this.toastService.showError('Clone BDD', `Mode inversé impossible: table manquante en Sandbox ou Production.`);
        return;
      }
      source_table = row.sandbox.Table?.TableName ?? '';
      destination_table = row.production.Table?.TableName ?? '';
      
      if (!confirm(`⚠️ ATTENTION : Vous allez écraser la table PRODUCTION "${tableName}" avec les données de SANDBOX.\n\nCette opération est IRRÉVERSIBLE et DANGEREUSE !\n\nConfirmez-vous cette action ?`)) {
        console.warn(`[CLONE INVERSÉ ANNULÉ] L'utilisateur a refusé de cloner ${source_table} vers ${destination_table}`);
        return;
      }
      console.warn(`[CLONE INVERSÉ] Clonage DANGEREUX de ${source_table} vers ${destination_table}`);
    } else {
      // Mode normal : production → sandbox
      if (!row.production) {
        this.toastService.showError('Clone BDD', `Table Production manquante pour ${tableName}.`);
        return;
      }
      source_table = row.production.Table?.TableName ?? '';
      destination_table = source_table.replace(this.production_apid, environment.sandbox_apid);
      console.log(`Cloning table ${source_table} to ${destination_table}`);
    }
    
    if (!source_table) return;
    this.started = true;
    this.rowCloning.set(tableName, true);

    console.log(`Deleting items from ${destination_table}`);
    this.batchService.scanTable(destination_table, 0).pipe(
      switchMap((items) => {
        if (items.length > 0) {
          return this.batchService.batchDeleteItem(destination_table, items);
        }
        return of([]);
      })
    ).subscribe({
      next: () => {
        console.log(`Items deleted from ${destination_table}`);
        this.copy_table(tableName, source_table, destination_table);
      },
      error: (error) => {
        console.error('Error deleting items:', error);
        this.finishRow(tableName);
      }
    });
  }

  copy_table(tableName: string, source_table: string, destination_table: string) {
    console.log(`Copying items from ${source_table} to ${destination_table}`);
    this.batchService.scanTable(source_table, 0).pipe(
      switchMap((items) => {
        if (items.length > 0) {
          return this.batchService.batchWriteItem(destination_table, items);
        }
        return of([]);
      })
    ).subscribe({
      next: () => {
        console.log(`Items copied from ${source_table} to ${destination_table}`);
        this.validateCounts(tableName, source_table, destination_table);
      },
      error: (error) => {
        console.error('Error copying items:', error);
        this.toastService.showError('Clone BDD', `Erreur lors du clonage de la table ${tableName}`);
        this.finishRow(tableName);
      }
    });
  }

  private validateCounts(tableName: string, source_table: string, destination_table: string) {
    this.batchService.scanTable(source_table, 0).pipe(
      switchMap((srcItems) => this.batchService.scanTable(destination_table, 0).pipe(map(destItems => ({ src: srcItems, dest: destItems }))))
    ).subscribe({
      next: ({ src, dest }) => {
        const srcCount = src.length;
        const destCount = dest.length;
        
        // Update UI counts
        const row = this.tableRows.find(r => r.name === tableName);
        if (row) {
          if (row.production?.Table) {
            row.production.Table.ItemCount = srcCount;
          }
          if (row.sandbox?.Table) {
            row.sandbox.Table.ItemCount = destCount;
          }
        }
        
        if (srcCount === destCount) {
          this.toastService.showSuccess('Clone BDD', `Table ${tableName} clonée et vérifiée (${srcCount} items).`);
        } else {
          this.toastService.showWarning('Clone BDD', `Clonage terminé mais écart détecté: source=${srcCount}, dest=${destCount}.`);
        }
        this.finishRow(tableName);
      },
      error: (_e) => {
        this.toastService.showWarning('Clone BDD', `Clonage terminé, mais la validation a échoué pour ${tableName}.`);
        this.finishRow(tableName);
      }
    });
  }

  async cloneSelected() {
    const selectedNames = Array.from(this.selected.entries())
      .filter(([_, selected]) => selected)
      .map(([name, _]) => name);
    
    if (selectedNames.length === 0) {
      this.toastService.showInfo('Clone BDD', 'Aucune table sélectionnée');
      return;
    }
    this.started = true;
    // Démarre les clones en parallèle
    for (const name of selectedNames) {
      this.cloneTableAt(name);
    }
    // Surveille la fin de tous les clones sélectionnés
    const timer = setInterval(() => {
      const allDone = selectedNames.every(name => this.rowCloning.get(name) === false);
      if (allDone) {
        clearInterval(timer);
        this.refreshCountsLive();
      }
    }, 1000);
  }

  private finishRow(tableName: string) {
    this.rowCloning.set(tableName, false);
    // Si plus aucune ligne n'est en cours, libère l'UI
    const allDone = Array.from(this.rowCloning.values()).every(v => v === false);
    if (allDone) {
      this.started = false;
    }
  }

  // Live refresh of item counts using strong-consistency scans
  refreshCountsLive() {
    this.started = true;
    
    // Build observable array for all tables
    const scans: Observable<{ name: string; type: 'production' | 'sandbox'; count: number }>[] = [];
    
    this.tableRows.forEach(row => {
      if (row.production?.Table?.TableName) {
        const name = row.production.Table.TableName;
        scans.push(
          this.batchService.scanTable(name, 0).pipe(
            map(items => ({ name: row.name, type: 'production' as const, count: items.length }))
          )
        );
      }
      if (row.sandbox?.Table?.TableName) {
        const name = row.sandbox.Table.TableName;
        scans.push(
          this.batchService.scanTable(name, 0).pipe(
            map(items => ({ name: row.name, type: 'sandbox' as const, count: items.length }))
          )
        );
      }
    });

    if (scans.length === 0) {
      this.started = false;
      return;
    }

    combineLatest(scans).subscribe({
      next: (results) => {
        // Update counts in tableRows
        results.forEach(result => {
          const row = this.tableRows.find(r => r.name === result.name);
          if (row) {
            if (result.type === 'production' && row.production?.Table) {
              row.production.Table.ItemCount = result.count;
            } else if (result.type === 'sandbox' && row.sandbox?.Table) {
              row.sandbox.Table.ItemCount = result.count;
            }
          }
        });
        this.toastService.showInfo('Clone BDD', 'Comptes mis à jour (live)');
        this.started = false;
      },
      error: (_e) => {
        this.toastService.showError('Clone BDD', 'Échec du rafraîchissement (live)');
        this.started = false;
      }
    });
  }
}
