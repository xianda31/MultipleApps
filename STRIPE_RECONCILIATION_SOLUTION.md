# 💰 Réconciliation Stripe & Relevé Bancaire - Plan Détaillé

**Date:** 1er Avril 2026  
**Statut:** ✅ **APPROUVÉ - EN TODO**  
**Dépend De:** Phase 1 (QR Invoice Stripe)  
**Priorité:** Haute (Critique pour tréso)  
**Effort Estimé:** 1-2 jours  

---

## 📋 **Résumé Exécutif**

### 🎯 Objectif
Automatiser le rapprochement entre :
- **Stripe Dashboard** → Montants bruts + fees
- **Relevé Bancaire** → Virements reçus
- **Table DynamoDB** → Transactions enregistrées

### 💡 Solution
**Script Lambda quotidien** qui :
1. Récupère payout du jour depuis Stripe
2. Calcule totaux StripeTransaction en DB
3. Valide: `montants matching`
4. Marque transactions comme `reconciled`
5. Génère rapport d'auditabilité

### 📊 Résultat Attendu
```
Relevé Bancaire:
  2 Avril  STRIPE TRANSFER    +98.71€  ← Reçu
  
Dashboard Trésorier:
  Transactions: 5 × 101.00€ = 505.00€ brut
  Fees:                      = -14.65€ (2.9% + 0.30€)
  Net reçu:                  = 490.35€ ✅
  Status: RECONCILED
```

---

## 🏗️ **Architecture - Vue d'Ensemble**

### **Flux Automatisé**

```
QUOTIDIENNEMENT à T+2
(ex: 3 Avril 09:00 AM pour paiements du 1er Avril)

EventBridge Cron
     ↓
Lambda reconcile-stripe-daily
     ├─ Stripe API: récupère payout du 1er Avril
     ├─ DynamoDB: queries StripeTransaction du 1er Avril
     ├─ Compare: montants matching
     ├─ Update: mark 'reconciled' + payout_id
     └─ If error: envoi alert email admin
     ↓
StripeTransaction table
   status: 'reconciled'
   releve_reference: 'su_xxx'
   reconciled_at: 2026-04-03T09:15:00Z
```

### **Intégration Dashboard**

```
Treasury Component
     ↓
Requêtes StripeTransaction:
├─ Aujourd'hui: status != 'reconciled' (en attente)
├─ Hier: status = 'reconciled' (confirmé)
└─ Semaine: tous groupés
     ↓
Affiche:
├─ Transactions pending
├─ Payout reçu + date virement
├─ Montants: brut / fees / net
└─ % fee rate (devrait être ~2.9%)
```

---

## 💾 **Schéma DynamoDB - Modifications**

### **Avant (Existant)**

```typescript
// amplify/data/resource.ts
export const StripeTransaction = a.model({
  id: a.id().required(),
  sessionId: a.string().required(),
  status: a.enum(['pending', 'completed_by_webhook', 'processed', 'failed']),
  stripeMeta: a.json(),
  // ... autres champs
})
```

### **Après (À Ajouter)**

```typescript
export const StripeTransaction = a.model({
  id: a.id().required(),
  
  // Identifiants (existant)
  sessionId: a.string().required(),
  paymentIntentId: a.string(),
  
  // ✨ NOUVEAU: Montants détaillés (en centimes)
  amount_gross_cents: a.integer().required(), // 10100 = 101.00€
  amount_fees_cents: a.integer(),             // 229 = 2.29€
  amount_net_cents: a.integer(),              // 9871 = 98.71€
  
  // Status (étendu)
  status: a.enum([
    'pending',                  // Créé, pas encore payé
    'completed_by_webhook',     // Payé via Stripe webhook
    'processed',                // BookEntry créée
    'reconciled',               // ← NOUVEAU: Match relevé bancaire
    'failed',
    'disputed'                  // Pour chargebacks futurs
  ]).required(),
  
  // ✨ NOUVEAU: Réconciliation bancaire
  releve_reference: a.string(),   // ex: "su_1234567890..."
  reconciled_at: a.datetime(),    // Quand la reconciliation a eu lieu
  reconciliation_notes: a.string(),
  
  // Métadonnées (existant)
  stripeMeta: a.json().required(),  // {cartSnapshot, memberName, date...}
  
  // Dates (existant + clarification)
  created_at: a.datetime().required(),  // Quand la transaction est créée
  paid_at: a.datetime(),                 // Quand webhook reçu
  
  // Traçabilité (existant)
  buyerMemberId: a.string(),
  season: a.string(),
  receiptUrl: a.string()
})
.authorization(allow => [
  allow.owner()
]);
```

### **Migration**

```sql
-- Amplify migration
ALTER TABLE StripeTransaction 
ADD COLUMN amount_gross_cents INT,
ADD COLUMN amount_fees_cents INT,
ADD COLUMN amount_net_cents INT,
ADD COLUMN releve_reference VARCHAR(255),
ADD COLUMN reconciled_at DATETIME,
ADD COLUMN reconciliation_notes TEXT;

-- Populate montants à partir de stripeMeta
UPDATE StripeTransaction
SET 
  amount_gross_cents = CAST(stripeMeta->>'$.amount_gross' AS INT) * 100,
  amount_fees_cents = CAST(stripeMeta->>'$.amount_fees' AS INT) * 100,
  amount_net_cents = CAST(stripeMeta->>'$.amount_net' AS INT) * 100
WHERE amount_gross_cents IS NULL;
```

---

## 🔧 **Implémentation - Lambda Reconciliation**

### **Fichier 1: handler.ts**

```typescript
// amplify/functions/reconcile-stripe-daily/handler.ts

import Stripe from 'stripe';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const stripe = new Stripe(process.env['STRIPE_SECRET_KEY'] || 'dummy', {
  apiVersion: '2024-04-10' as any,
});

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const sesClient = new SESClient({});

const STRIPE_TRANSACTION_TABLE = process.env['STRIPE_TRANSACTION_TABLE_NAME'];
const ADMIN_EMAIL = process.env['ADMIN_EMAIL'] || 'admin@example.com';

interface ReconciliationResult {
  date: string;
  transaction_count: number;
  amount_gross_eur: string;
  amount_fees_eur: string;
  amount_net_eur: string;
  payout_id: string;
  arrival_date: number;
  status: 'success' | 'error' | 'no_data';
  error_message?: string;
}

/**
 * Handler déclenché quotidiennement par EventBridge (T+2)
 * ex: pour paiements du 1er Avril, lancé le 3 Avril 09:00
 */
export async function handler(event: any): Promise<ReconciliationResult> {
  console.log('[Reconcile] Starting daily reconciliation');
  
  try {
    // Déterminer la date à réconcilier (hier ou avant-hier selon timing)
    const reconcileDate = getReconciliationDate();
    console.log(`[Reconcile] Target reconciliation date: ${reconcileDate}`);
    
    // ___________________
    // 1️⃣ STRIPE PAYOUT
    // ___________________
    
    const payouts = await stripe.payouts.list({
      created: {
        gte: Math.floor(new Date(reconcileDate).getTime() / 1000),
        lt: Math.floor(new Date(reconcileDate + 'T23:59:59').getTime() / 1000)
      },
      limit: 100
    });
    
    if (payouts.data.length === 0) {
      console.log('[Reconcile] No payouts found on Stripe for this date');
      return {
        date: reconcileDate,
        transaction_count: 0,
        amount_gross_eur: '0.00',
        amount_fees_eur: '0.00',
        amount_net_eur: '0.00',
        payout_id: 'NONE',
        arrival_date: 0,
        status: 'no_data'
      };
    }
    
    const payout = payouts.data[0];
    const stripeNetCents = payout.amount; // en centimes
    
    console.log('[Reconcile] Stripe payout:', {
      id: payout.id,
      amount_cents: payout.amount,
      amount_eur: (payout.amount / 100).toFixed(2),
      fee_cents: payout.fee,
      fee_eur: (payout.fee / 100).toFixed(2),
      arrival_date: new Date(payout.arrival_date * 1000).toISOString()
    });
    
    // ___________________
    // 2️⃣ DATABASE QUERIES
    // ___________________
    
    const queryCommand = new QueryCommand({
      TableName: STRIPE_TRANSACTION_TABLE!,
      IndexName: 'created_at-index', // Assuming GSI exists
      KeyConditionExpression: 'created_at BETWEEN :start AND :end',
      ExpressionAttributeValues: {
        ':start': `${reconcileDate}T00:00:00Z`,
        ':end': `${reconcileDate}T23:59:59Z`
      }
    });
    
    const dbResponse = await docClient.send(queryCommand);
    const transactions = (dbResponse.Items || []) as any[];
    
    console.log(`[Reconcile] Found ${transactions.length} transactions in DB`);
    
    if (transactions.length === 0) {
      console.warn('[Reconcile] No transactions in DB for this date, but Stripe has payout');
      // ⚠️ ALERTE: Data mismatch
      await sendAlertEmail({
        subject: 'Stripe Reconciliation ALERT: Payout without DB transactions',
        body: `
          Date: ${reconcileDate}
          Payout: ${(payout.amount / 100).toFixed(2)}€
          DB Transactions: 0
          
          Check if transactions were not recorded properly.
        `,
        critical: true
      });
      
      return {
        date: reconcileDate,
        transaction_count: 0,
        amount_gross_eur: '0.00',
        amount_fees_eur: '0.00',
        amount_net_eur: '0.00',
        payout_id: payout.id,
        arrival_date: payout.arrival_date,
        status: 'error',
        error_message: 'Payout found but no DB transactions'
      };
    }
    
    // ___________________
    // 3️⃣ CALCULATE TOTALS
    // ___________________
    
    let totalGrossCents = 0;
    let totalFeesCents = 0;
    
    for (const tx of transactions) {
      totalGrossCents += tx.amount_gross_cents || 0;
      totalFeesCents += -(tx.amount_fees_cents || 0);
    }
    
    const totalNetCents = totalGrossCents + totalFeesCents;
    
    console.log('[Reconcile] DB totals:', {
      gross_cents: totalGrossCents,
      gross_eur: (totalGrossCents / 100).toFixed(2),
      fees_cents: totalFeesCents,
      fees_eur: (totalFeesCents / 100).toFixed(2),
      net_cents: totalNetCents,
      net_eur: (totalNetCents / 100).toFixed(2)
    });
    
    // ___________________
    // 4️⃣ VALIDATE MATCH
    // ___________________
    
    const tolerance = 50; // 0.50€ tolerance (in case of rounding edge cases)
    const difference = Math.abs(totalNetCents - stripeNetCents);
    
    console.log('[Reconcile] Comparing:', {
      stripe_net_cents: stripeNetCents,
      db_net_cents: totalNetCents,
      difference_cents: Math.abs(stripeNetCents - totalNetCents),
      match: difference <= tolerance
    });
    
    if (difference > tolerance) {
      console.error('❌ RECONCILIATION MISMATCH!');
      
      // 🚨 ALERTE CRITIQUE
      await sendAlertEmail({
        subject: `❌ CRITICAL: Stripe Reconciliation Failed for ${reconcileDate}`,
        body: `
          Amount Mismatch Detected:
          
          Stripe Payout Net: €${(stripeNetCents / 100).toFixed(2)}
          Database Total Net: €${(totalNetCents / 100).toFixed(2)}
          Difference: €${(difference / 100).toFixed(2)}
          
          Payout ID: ${payout.id}
          Status: ${payout.status}
          Arrival Date: ${new Date(payout.arrival_date * 1000).toISOString()}
          
          ACTION REQUIRED:
          1. Check Stripe Dashboard for dispute/adjustment
          2. Verify BookEntry amounts in DB
          3. Contact support if needed
        `,
        critical: true
      });
      
      return {
        date: reconcileDate,
        transaction_count: transactions.length,
        amount_gross_eur: (totalGrossCents / 100).toFixed(2),
        amount_fees_eur: (totalFeesCents / 100).toFixed(2),
        amount_net_eur: (totalNetCents / 100).toFixed(2),
        payout_id: payout.id,
        arrival_date: payout.arrival_date,
        status: 'error',
        error_message: `Net amount mismatch: Stripe ${stripeNetCents} vs DB ${totalNetCents}`
      };
    }
    
    console.log('✅ Reconciliation MATCH - Proceeding with update');
    
    // ___________________
    // 5️⃣ UPDATE DATABASE
    // ___________________
    
    const now = new Date().toISOString();
    const updatePromises = transactions.map(tx =>
      docClient.send(
        new UpdateCommand({
          TableName: STRIPE_TRANSACTION_TABLE!,
          Key: { id: tx.id },
          UpdateExpression: `
            SET #status = :reconciled,
                reconciled_at = :now,
                releve_reference = :payoutId,
                reconciliation_notes = :notes
          `,
          ExpressionAttributeNames: {
            '#status': 'status'
          },
          ExpressionAttributeValues: {
            ':reconciled': 'reconciled',
            ':now': now,
            ':payoutId': payout.id,
            ':notes': `Auto-reconciled with payout ${payout.id} by Lambda`
          }
        })
      )
    );
    
    await Promise.all(updatePromises);
    
    console.log(`[Reconcile] ✅ Updated ${transactions.length} transactions to 'reconciled'`);
    
    // ___________________
    // 6️⃣ SEND SUCCESS EMAIL
    // ___________________
    
    await sendAlertEmail({
      subject: `✅ Stripe Reconciliation Successful for ${reconcileDate}`,
      body: `
        Reconciliation Report:
        ─────────────────────────────────────────
        Date: ${reconcileDate}
        Transactions: ${transactions.length}
        Gross Amount: €${(totalGrossCents / 100).toFixed(2)}
        Fees (Stripe): €${(totalFeesCents / 100).toFixed(2)}
        Net (Received): €${(totalNetCents / 100).toFixed(2)}
        
        Payout ID: ${payout.id}
        Arrival Date: ${new Date(payout.arrival_date * 1000).toISOString()}
        
        Status: ✅ RECONCILED
        
        All ${transactions.length} transactions marked as reconciled.
      `,
      critical: false
    });
    
    // ___________________
    // 7️⃣ RETURN RESULT
    // ___________________
    
    return {
      date: reconcileDate,
      transaction_count: transactions.length,
      amount_gross_eur: (totalGrossCents / 100).toFixed(2),
      amount_fees_eur: (totalFeesCents / 100).toFixed(2),
      amount_net_eur: (totalNetCents / 100).toFixed(2),
      payout_id: payout.id,
      arrival_date: payout.arrival_date,
      status: 'success'
    };
    
  } catch (error) {
    console.error('❌ Reconciliation failed with error:', error);
    
    await sendAlertEmail({
      subject: '❌ Stripe Reconciliation Lambda Error',
      body: `
        Error Details:
        \`\`\`
        ${error instanceof Error ? error.message : String(error)}
        \`\`\`
        
        Stack:
        \`\`\`
        ${error instanceof Error ? error.stack : 'N/A'}
        \`\`\`
        
        Please check Lambda logs immediately.
      `,
      critical: true
    });
    
    throw error;
  }
}

/**
 * Détermine la date à réconcilier
 * (généralement hier, sauf si weekday edge case)
 */
function getReconciliationDate(): string {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  return yesterday.toISOString().split('T')[0];
}

/**
 * Envoie email d'alerte à l'admin
 */
async function sendAlertEmail(params: {
  subject: string;
  body: string;
  critical: boolean;
}): Promise<void> {
  try {
    const command = new SendEmailCommand({
      Source: 'noreply@yourdomain.com',
      Destination: {
        ToAddresses: [ADMIN_EMAIL]
      },
      Message: {
        Subject: {
          Data: params.subject
        },
        Body: {
          Text: {
            Data: params.body
          }
        }
      }
    });
    
    await sesClient.send(command);
    console.log('[Email] Sent alert:', params.subject);
    
  } catch (err) {
    console.error('[Email] Failed to send alert:', err);
    // Don't throw - don't want email failure to fail whole reconciliation
  }
}
```

### **Fichier 2: resource.ts**

```typescript
// amplify/functions/reconcile-stripe-daily/resource.ts

import { defineFunction } from '@aws-amplify/backend';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';

export const reconcileStripeDailyFunction = defineFunction({
  name: 'reconcile-stripe-daily',
  entry: './handler.ts',
  environment: {
    STRIPE_SECRET_KEY: process.env['STRIPE_SECRET_KEY'],
    STRIPE_TRANSACTION_TABLE_NAME: 'StripeTransaction', // Amplify auto-generates
    ADMIN_EMAIL: process.env['ADMIN_EMAIL'] || 'admin@example.fr'
  },
  timeoutSeconds: 60,
  memoryMB: 256
});

// EventBridge Cron: Daily at 09:00 UTC (T+2 from previous day transactions)
export const reconcileSchedule = new Rule(reconcileStripeDailyFunction.stack, 'DailyReconcileRule', {
  schedule: Schedule.cron({ minute: '0', hour: '9' }), // 09:00 UTC daily
  targets: [new LambdaTarget(reconcileStripeDailyFunction)]
});
```

### **Fichier 3: package.json**

```json
{
  "name": "reconcile-stripe-daily",
  "version": "1.0.0",
  "description": "Daily Stripe reconciliation Lambda",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "test": "jest"
  },
  "dependencies": {
    "stripe": "^14.0.0",
    "@aws-sdk/client-dynamodb": "^3.x.x",
    "@aws-sdk/lib-dynamodb": "^3.x.x",
    "@aws-sdk/client-ses": "^3.x.x"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
```

---

## 📊 **Dashboard Trésorier - Component**

### **treasury-dashboard.component.ts**

```typescript
import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { StripeTransactionService } from '../services/stripe-transaction.service';

interface TreasuryStats {
  today: {
    transaction_count: number;
    amount_pending_gross_cents: number;
    status: 'waiting' | 'no_data';
  };
  yesterday: {
    transaction_count: number;
    amount_gross_cents: number;
    amount_fees_cents: number;
    amount_net_cents: number;
    payout_id: string;
    payout_date: Date;
    status: 'reconciled' | 'pending' | 'error';
  };
  this_week: {
    transaction_count: number;
    amount_gross_cents: number;
    amount_fees_cents: number;
    amount_net_cents: number;
    fee_percentage: number;
  };
}

@Component({
  selector: 'app-treasury-dashboard',
  templateUrl: './treasury-dashboard.component.html',
  styleUrls: ['./treasury-dashboard.component.scss']
})
export class TreasuryDashboardComponent implements OnInit {
  stats$: Observable<TreasuryStats>;
  
  constructor(private stripeService: StripeTransactionService) {}
  
  ngOnInit() {
    // RxJS queries
    this.stats$ = this.loadTreasuryStats();
  }
  
  private loadTreasuryStats(): Observable<TreasuryStats> {
    return new Observable(observer => {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7*86400000).toISOString().split('T')[0];
      
      // Queries
      this.stripeService.getTransactionsByDate(today)
        .then(todayTxs => {
          const todayStats = {
            transaction_count: todayTxs.length,
            amount_pending_gross_cents: todayTxs.reduce((s, t) => s + t.amount_gross_cents, 0),
            status: todayTxs.length > 0 ? 'waiting' as const : 'no_data' as const
          };
          
          return this.stripeService.getTransactionsByDate(yesterday)
            .then(yesterdayTxs => ({
              todayStats,
              yesterdayTxs
            }));
        })
        .then(({ todayStats, yesterdayTxs }) => {
          const yesterdayStats = {
            transaction_count: yesterdayTxs.length,
            amount_gross_cents: yesterdayTxs.reduce((s, t) => s + t.amount_gross_cents, 0),
            amount_fees_cents: -yesterdayTxs.reduce((s, t) => s + (t.amount_fees_cents || 0), 0),
            amount_net_cents: yesterdayTxs.reduce((s, t) => s + (t.amount_net_cents || 0), 0),
            payout_id: yesterdayTxs[0]?.releve_reference || 'PENDING',
            payout_date: yesterdayTxs[0]?.reconciled_at || new Date(),
            status: yesterdayTxs[0]?.status === 'reconciled' ? 'reconciled' as const : 'pending' as const
          };
          
          return this.stripeService.getTransactionsByDateRange(weekAgo, today)
            .then(weekTxs => ({
              todayStats,
              yesterdayStats,
              weekTxs
            }));
        })
        .then(({ todayStats, yesterdayStats, weekTxs }) => {
          const weekStats = {
            transaction_count: weekTxs.length,
            amount_gross_cents: weekTxs.reduce((s, t) => s + t.amount_gross_cents, 0),
            amount_fees_cents: -weekTxs.reduce((s, t) => s + (t.amount_fees_cents || 0), 0),
            amount_net_cents: weekTxs.reduce((s, t) => s + (t.amount_net_cents || 0), 0),
            fee_percentage: weekTxs.length > 0 
              ? Math.round((weekStats.amount_fees_cents / weekStats.amount_gross_cents) * 10000) / 100
              : 0
          };
          
          observer.next({
            today: todayStats,
            yesterday: yesterdayStats,
            this_week: weekStats
          });
          observer.complete();
        })
        .catch(err => observer.error(err));
    });
  }
  
  // Helper
  formatCent(cents: number): string {
    return (cents / 100).toFixed(2) + '€';
  }
}
```

### **treasury-dashboard.component.html**

```html
<div class="treasury-dashboard">
  <h1>📊 Trésorier - Suivi Stripe</h1>
  
  @if (stats$ | async as stats) {
    <!-- TODAY -->
    <div class="card today">
      <h2>Aujourd'hui ({{ stats.today.transaction_count }} transactions)</h2>
      
      @if (stats.today.status === 'no_data') {
        <p class="no-data">Aucune transaction</p>
      } @else {
        <div class="stat">
          <span>En attente de paiement:</span>
          <strong>{{ stats.today.amount_pending_gross_cents / 100 | currency }}</strong>
        </div>
        <small>Les virements Stripe arrivent T+1 (demain)</small>
      }
    </div>
    
    <!-- YESTERDAY -->
    <div class="card yesterday" [class.success]="stats.yesterday.status === 'reconciled'">
      <h2>Hier ({{ stats.yesterday.transaction_count }} transactions)</h2>
      
      <div class="stat">
        <span>Montant brut:</span>
        <strong>{{ stats.yesterday.amount_gross_cents / 100 | currency }}</strong>
      </div>
      
      <div class="stat detail">
        <span>- Fees Stripe:</span>
        <span class="fee">{{ stats.yesterday.amount_fees_cents / 100 | currency }}</span>
      </div>
      
      <div class="stat divider">
        <span>Virement reçu:</span>
        <strong style="color: green;">{{ stats.yesterday.amount_net_cents / 100 | currency }}</strong>
      </div>
      
      <div class="payout-info">
        <p><strong>Payout:</strong> {{ stats.yesterday.payout_id }}</p>
        <p><strong>Date:</strong> {{ stats.yesterday.payout_date | date:'dd/MM/yyyy HH:mm' }}</p>
        <p>
          <strong>Status:</strong>
          @if (stats.yesterday.status === 'reconciled') {
            <span class="badge success">✅ RECONCILIÉ</span>
          } @else if (stats.yesterday.status === 'pending') {
            <span class="badge pending">⏳ EN ATTENTE</span>
          } @else {
            <span class="badge error">❌ ERREUR</span>
          }
        </p>
      </div>
    </div>
    
    <!-- WEEK -->
    <div class="card week">
      <h2>Cette Semaine ({{ stats.this_week.transaction_count }} transactions)</h2>
      
      <div class="week-grid">
        <div class="stat">
          <span>Total brut:</span>
          <strong>{{ stats.this_week.amount_gross_cents / 100 | currency }}</strong>
        </div>
        <div class="stat">
          <span>Total fees:</span>
          <strong>{{ stats.this_week.amount_fees_cents / 100 | currency }}</strong>
          <small>({{ stats.this_week.fee_percentage }}%)</small>
        </div>
        <div class="stat">
          <span>Total net reçu:</span>
          <strong style="color: green;">{{ stats.this_week.amount_net_cents / 100 | currency }}</strong>
        </div>
      </div>
    </div>
    
    <!-- ACTIONS -->
    <div class="actions">
      <button (click)="exportMonthlyCSV()">📥 Export CSV Mensuel</button>
      <button (click)="refreshData()">🔄 Actualiser</button>
    </div>
  }
</div>
```

### **treasury-dashboard.component.scss**

```scss
.treasury-dashboard {
  padding: 2rem;
  background: #f9f9f9;
  
  h1 {
    margin-bottom: 2rem;
    color: #333;
  }
  
  .card {
    background: white;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    
    h2 {
      font-size: 1.2rem;
      margin-bottom: 1rem;
      color: #555;
    }
  }
  
  .today {
    border-left: 4px solid #ff9800;
  }
  
  .yesterday {
    border-left: 4px solid #2196f3;
    
    &.success {
      border-left-color: #4caf50;
      background: #f1f8f5;
    }
  }
  
  .week {
    border-left: 4px solid #9c27b0;
  }
  
  .stat {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 0;
    border-bottom: 1px solid #eee;
    
    &.divider {
      padding-top: 0.5rem;
      padding-bottom: 0.5rem;
      border-top: 2px solid #ddd;
      border-bottom: 2px solid #ddd;
      margin: 0.5rem 0;
    }
    
    &.detail {
      padding: 0.5rem 2rem;
      border: none;
      
      .fee {
        color: #d32f2f;
        font-weight: bold;
      }
    }
    
    strong {
      font-size: 1.1rem;
      color: #333;
    }
    
    small {
      color: #999;
      margin-left: 0.5rem;
      font-size: 0.85rem;
    }
  }
  
  .payout-info {
    background: #f5f5f5;
    padding: 1rem;
    border-radius: 4px;
    margin-top: 1rem;
    
    p {
      margin: 0.25rem 0;
      font-size: 0.9rem;
      
      strong {
        margin-right: 0.5rem;
      }
    }
  }
  
  .badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.85rem;
    font-weight: bold;
    
    &.success {
      background: #c8e6c9;
      color: #2e7d32;
    }
    
    &.pending {
      background: #fff9c4;
      color: #f57f17;
    }
    
    &.error {
      background: #ffcdd2;
      color: #c62828;
    }
  }
  
  .week-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    
    .stat {
      border: none;
      flex-direction: column;
      align-items: flex-start;
      
      span {
        color: #999;
        font-size: 0.9rem;
      }
      
      strong {
        font-size: 1.3rem;
        margin-top: 0.5rem;
      }
    }
  }
  
  .actions {
    margin-top: 2rem;
    display: flex;
    gap: 1rem;
    
    button {
      padding: 0.75rem 1.5rem;
      background: #2196f3;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      
      &:hover {
        background: #1976d2;
      }
    }
  }
  
  .no-data {
    color: #999;
    text-align: center;
    padding: 2rem 0;
  }
}
```

---

## 📤 **Service Export CSV**

```typescript
// stripe-reconciliation-export.service.ts

@Injectable()
export class StripeReconciliationExportService {
  
  async exportMonthlyCSV(year: string, month: string): Promise<Blob> {
    const txs = await this.db.stripeTransactions
      .where('created_at').gte(`${year}-${month}-01`)
      .and('created_at').lte(`${year}-${month}-31`)
      .where('status').eq('reconciled')
      .toArray();
    
    // Build CSV
    const headers = [
      'Date',
      'Session ID',
      'Member ID',
      'Amount Gross (EUR)',
      'Fees (EUR)',
      'Amount Net (EUR)',
      'Status',
      'Payout Reference',
      'Reconciled At'
    ];
    
    const rows = txs.map(tx => [
      new Date(tx.created_at).toLocaleDateString('fr-FR'),
      tx.sessionId,
      tx.buyerMemberId || '-',
      (tx.amount_gross_cents / 100).toFixed(2),
      (tx.amount_fees_cents / 100).toFixed(2),
      (tx.amount_net_cents / 100).toFixed(2),
      tx.status,
      tx.releve_reference || '-',
      tx.reconciled_at ? new Date(tx.reconciled_at).toLocaleString('fr-FR') : '-'
    ]);
    
    // Format CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(c => `"${c}"`).join(','))
    ].join('\n');
    
    return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  }
  
  downloadCSV(year: string, month: string) {
    this.exportMonthlyCSV(year, month).then(blob => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `stripe-reconciliation-${year}-${month}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }
}
```

---

## 🎯 **Checklist Implémentation**

### **J1 - Matin: Préparation**
- [ ] Ajouter fields à StripeTransaction schema
- [ ] Créer migration DynamoDB
- [ ] Vérifier Stripe API (payouts.list)
- [ ] Créer compte SES pour emails

### **J1 - Après-midi: Lambda**
- [ ] Créer dossier `reconcile-stripe-daily`
- [ ] Implémenter handler.ts
- [ ] Implémenter resource.ts + EventBridge cron
- [ ] Tests unitaires

### **J2 - Matin: Dashboard**
- [ ] Créer component treasury-dashboard
- [ ] Template + CSS
- [ ] Queries DynamoDB (today/yesterday/week)
- [ ] Binding

### **J2 - Après-midi: Polish**
- [ ] Service export CSV
- [ ] Intégrer à menu admin
- [ ] Tests E2E
- [ ] Déploiement staging

---

## 📊 **Résultat Final Attendu**

```
Relevé Bancaire:
  2 Avril  STRIPE TRANSFER    +490.35€
  
Stripe Dashboard:
  Gross payout: €505.00
  Fees: €14.65
  Net: €490.35
  
Treasury Dashboard:
  Hier:
    ✅ 5 transactions reconciliées
    Brut: €505.00
    Fees: €14.65 (2.90%)
    Net reçu: €490.35
    Status: RECONCILIÉ
  
Export CSV (comptable):
  [rows de toutes les transactions du mois]
```

---

## ✅ **Status Final**

🟢 **Approuvé pour implémentation**  
🟢 **Architecture validée**  
🟢 **Dépend de: Phase 1 (QR Invoice Stripe)**  
🟡 **À implémenter après Phase 1 complétée**  

**Prochaines étapes:**
1. Déployer Phase 1 (QR Invoice)
2. Lancer Phase 2 (Réconciliation) après validation Phase 1
3. Ajouter alias/splits paiements si besoin futur

---

**Document créé:** 1er Avril 2026  
**Version:** 1.0 - APPROUVÉ POUR IMPLÉMENTATION
