# 💳 Solution QR Invoice Stripe - Plan d'Implémentation Complet

**Date:** 1er Avril 2026  
**Statut:** ✅ **APPROUVÉ - EN TODO**  
**Priorité:** Moyenne (après dashboard)  
**Effort Estimé:** 2-3 jours  

---

## 📋 **Résumé Exécutif**

### 🎯 Objectif
Ajouter **paiement par carte** avec **minimum d'effort** pour :
- ✅ Consolider comptes/relevés bancaires (100% Stripe)
- ✅ Zéro saisie manuelle montant du vendeur
- ✅ Zéro infra supplémentaire requise

### 💡 Solution Retenue
**QR Code Invoice Stripe** — Client scanne QR code généré par le shop, paie directement sur Stripe Checkout

### 📊 Comparatif Alternatives France

| Option | Format | Budget | Consolidation | Effort | Rejet |
|--------|--------|--------|----------------|--------|-------|
| **QR Invoice Stripe** | Digital | **0€** | ✅ 100% | ✅ 2-3j | ✅ Retenu |
| SumUp Air | BT reader | 60€ | ⚠️ Partiel | 1j | Comptes séparés |
| Stripe M2 | Terminal | 250€ | ✅ 100% | 1-2j | Indisponible FR |
| Verifone M440 | TPE | 250€+ | ✅ 100% | 1-2j | Surdimensionné |

---

## 🏗️ **Architecture Logicielle**

### Vue Conceptuelle

```
┌─────────────────────────────────────────────────────┐
│        Shop Component (Angular)                    │
│  • Mode Back-Office: nouveau bouton "QR Paiement"  │
│  • Mode Online: existant (inchangé)                │
└──────────┬──────────────────────────────────────────┘
           ↓
     ┌─────────────────────────────────────────┐
     │   Réutilise: stripe-checkout Lambda    │
     │   (AUCUNE nouvelle Lambda requise!)    │
     │   • Valide montants                    │
     │   • Crée Stripe Session                │
     │   • Encode URL en QR                   │
     └──────────┬──────────────────────────────┘
                ↓
     ┌─────────────────────────────────────────┐
     │   Stripe Checkout URL                  │
     │   • Client scanne → Paiement en ligne  │
     │   • Webhook callback                   │
     │   • StripeTransaction marked completed │
     └──────────┬──────────────────────────────┘
                ↓
     ┌─────────────────────────────────────────┐
     │   DynamoDB (Schéma inchangé)          │
     │   • BookEntry                         │
     │   • StripeTransaction (existant)      │
     │   • Pas de migration!                 │
     └─────────────────────────────────────────┘
```

### 🔄 Flux de Données

```
VENDEUR (Back-office)         CLIENT (Mobile)          BACKEND
┌──────────────────────────┐
│ Saisit montant/produits  │
│ Clique "Générer QR"      │
└──────────┬───────────────┘
           │ POST /stripe-checkout
           │ {cartSnapshot, debt, asset}
           ├─────────────────────────────────────→ Lambda
                                                   ├─ Valide
                                                   ├─ Crée Session Stripe
                                                   ├─ Sauve StripeTransaction
           ←─────────────────────────────────────┤
           │ {sessionUrl, sessionId}
           │
┌──────────▼───────────────┐
│ Affiche QR Modal         │
│ sessionId en session     │
│ "En attente paiement"    │
└──────────┬───────────────┘
           │
           │ Client scanne QR
           ├─────────────────────→ 📱
                                  ├─ Ouvre Stripe
                                  ├─ Affiche panier
                                  │  (montants validés)
                                  │
                                  │ Client saisit carte
                                  │ + paiement
                                  │
                                  ├─ Redirige vers Shop
                                  │  avec ?session_id=
           │←─────────────────────┤
           │
┌──────────▼───────────────┐
│ ngOnInit détecte params  │
│ match sessionId          │
│ Affiche spinner          │
└──────────┬───────────────┘
           │
           │ Polling/Webhook
           ├─────────────────────────────────────→ Backend
                                                   ├─ Vérifie Stripe
                                                   ├─ Valide montants
                                                   ├─ Update TX
           ←─────────────────────────────────────┤
           │
           │ Reconstruit panier
           │ Crée BookEntry
┌──────────▼───────────────┐
│ Bannière SUCCESS         │
│ Reçu Stripe PDF          │
│ Reset panier             │
└──────────────────────────┘
```

---

## 🔐 **Sécurité - Validation Hiérarchique**

| Étape | Validation | Par | Risque Bloqué |
|-------|-----------|-----|---------------|
| **1. Génération QR** | Frontend valide panier | Shop Component | Panier vide |
| **2. Envoi Backend** | Lambda récupère produits en DB | stripe-checkout | Prix manipulé |
| **3. Montants** | Lambda valide debt/asset > 0 | stripe-checkout | Montants négatifs |
| **4. Retour Client** | sessionId match sessionStorage | Shop Component | XSS/copy URL |
| **5. Webhook** | amount_total match DB | stripe-webhooks | Modification Stripe |
| **6. Création BookEntry** | Snapshot reconstruit 1:1 | CartService | Double paiement |

**Résultat:** Chaîne de validation impossible à contourner.

---

## 📲 **Processus Complet - 10 Étapes**

### **ÉTAPE 1-2 : Vendeur génère QR Invoice**

```typescript
// shop.component.ts - Bouton "Générer QR Paiement"

async onGenerateInvoiceQR() {
  // Valide panier
  if (!this.validateCart()) return;
  
  this.isGeneratingQR = true;
  
  try {
    // Appelle Lambda stripe-checkout EXISTANT
    const response = await this.stripeCheckout.initiateCheckout({
      productIds: this.cartItems.map(i => i.id),
      quantities: this.cartItems.map(i => i.quantity),
      debtAmountCents: this.debtAmount ? Math.round(this.debtAmount * 100) : 0,
      assetAmountCents: this.asset_amount ? Math.round(this.asset_amount * 100) : 0,
      memberName: this.selectedBuyer?.firstname,
      buyerMemberId: this.selectedBuyer?.id,
      cartSnapshot: this.cartItems,
      season: this.currentSeason,
      date: new Date().toISOString().split('T')[0],
    });

    const { sessionUrl, sessionId } = response;

    // 🔒 CRITIQUE: Sauvegarde sessionId localement
    this.sessionStorage.setItem('@stripe.invoiceSession', sessionId);
    this.sessionStorage.setItem('@stripe.invoiceDate', Date.now().toString());

    // Génère QR + affiche modal
    this.currentInvoiceQR = {
      qrUrl: sessionUrl,
      sessionId,
      expiresAt: Date.now() + 24 * 3600 * 1000
    };
    
    this.showInvoiceQRModal = true;

  } catch (error) {
    this.showErrorToast('Erreur QR: ' + error.message);
  } finally {
    this.isGeneratingQR = false;
  }
}
```

**Points clés:**
- Réutilise `stripe-checkout` Lambda existant
- Sauvegarde sessionId pour validation retour
- Affiche modal avec QR code (lib: `qrcode-angular`)

---

### **ÉTAPE 3-5 : Client scanne et paie (Hors Shop)**

```
📱 Téléphone Client
├─ Scanne QR code
├─ Safari → https://checkout.stripe.com/pay/cs_xxx
│
├─ Stripe affiche:
│   ┌─────────────────────────┐
│   │ Produits (du snapshot)  │
│   │ Article 1 ....... 12€   │
│   │ Article 2 ....... 13€   │
│   │ + Debt .......... 5€    │
│   │ - Asset ........ -3€    │
│   │ ─────────────────────── │
│   │ TOTAL PAYER 27€        │
│   └─────────────────────────┘
│
├─ Client saisit: [Carte] [MM/YY] [CVC]
├─ 3D Secure (optionnel)
├─ Stripe: ✅ PaymentIntent succeeded
│
└─ Redirige: /achat_en_ligne?checkout=success&session_id=cs_xxx
```

**Points clés:**
- Montants **100% validés par Lambda backend**
- Aucune saisie montant côté client
- URL de retour pré-configurée en Lambda

---

### **ÉTAPE 6-7 : Client retourne au Shop**

```typescript
// shop.component.ts - ngOnInit

ngOnInit() {
  this.route.queryParams.pipe(
    filter(params => params['checkout'] === 'success'),
    tap(params => {
      const sessionId = params['session_id'];
      
      // 🔒 Validation critique: sessionId match sessionStorage
      const storedSessionId = this.sessionStorage.getItem('@stripe.invoiceSession');
      const sessionAge = Date.now() - 
        parseInt(this.sessionStorage.getItem('@stripe.invoiceDate') || '0');
      
      if (sessionId !== storedSessionId) {
        console.error('❌ Session ID mismatch');
        this.showErrorToast('Erreur sécurité');
        return;
      }
      if (sessionAge > 24 * 3600 * 1000) {
        console.error('❌ Session expired');
        return;
      }
      
      // ✅ Notifie orchestrator
      this.stripeCheckout.notifyRedirectFromStripe(sessionId);
      this.showConfirmationSpinner = true;
    })
  ).subscribe();
}
```

**Points clés:**
- Compare sessionId retourné vs sessionStorage
- Temporal check (max 24h)
- Bloquer tout ID ne matchant pas

---

### **ÉTAPE 8 : Webhook Stripe → Backend**

```typescript
// amplify/functions/stripe-webhooks/handler.ts

export async function handleStripeWebhook(event: StripeEvent) {
  const stripeEvent = event.body;
  
  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const sessionId = session.id;
    
    // Récupère StripeTransaction depuis DB
    const tx = await db.stripeTransactions
      .where('sessionId').equals(sessionId).first();
    
    if (!tx) {
      console.error('❌ StripeTransaction not found');
      return { statusCode: 404 };
    }
    
    // 🔒 Vérifie montant depuis Stripe vs DB
    if (session.amount_total !== tx.stripeMeta.totalAmountCents) {
      console.error('❌ FRAUD: Amount mismatch!');
      return { statusCode: 400 };
    }
    
    // ✅ Marque completed
    const paymentIntent = await stripe.paymentIntents.retrieve(
      session.payment_intent
    );
    
    await db.stripeTransactions.update(tx.id, {
      status: 'completed_by_webhook',
      paymentIntentId: paymentIntent.id,
      receiptUrl: paymentIntent.charges.data[0]?.receipt_url,
      processedAt: new Date().toISOString()
    });
    
    // Signal au Shop via listener/SNS
    await notifyShopCompletion(sessionId);
  }
  
  return { statusCode: 200 };
}
```

**Points clés:**
- Vérifie intégrité montant Stripe vs DB
- Récupère receipt URL
- Signale au Shop (Firestore listener OU polling)

---

### **ÉTAPE 9 : Shop Détecte Completion**

```typescript
// shop.component.ts

private setupCheckoutCompletion() {
  // Option A: Real-time listener (recommandé)
  this.stripeCheckout.checkoutCompleted$
    .pipe(
      filter(status => status === 'completed_by_webhook'),
      tap(() => this.onCheckoutCompleted())
    )
    .subscribe();
    
  // Option B: Polling (fallback)
  interval(2000)
    .pipe(
      switchMap(() => 
        this.fetchStripeTransactionStatus(
          this.sessionStorage.getItem('@stripe.invoiceSession')
        )
      ),
      filter(tx => tx?.status === 'completed_by_webhook'),
      take(1),
      tap(() => this.onCheckoutCompleted())
    )
    .subscribe();
}

private async onCheckoutCompleted() {
  try {
    // Récupère metadata
    const sessionId = this.sessionStorage.getItem('@stripe.invoiceSession');
    const tx = await this.api.getStripeTransaction(sessionId);
    
    // Reconstruit panier EXACTEMENT comme sauvegardé
    await this.reconstructCartFromSnapshot(tx.stripeMeta.cartSnapshot);
    
    // Crée BookEntry (identique à checkout online)
    await this.cartService.save_sale({
      debtAmount: tx.stripeMeta.debtAmountCents / 100,
      assetAmount: tx.stripeMeta.assetAmountCents / 100,
      stripeTag: sessionId,
      stripeTransactionId: tx.id
    });
    
    // Affiche succès
    this.showSuccessBanner({
      message: 'Paiement reçu ✅',
      receiptLink: tx.receiptUrl
    });
    
    this.resetShop();
    
  } catch (error) {
    this.showErrorToast('Erreur finalisation: ' + error.message);
  }
}
```

**Points clés:**
- Deux canaux: Real-time listener + polling fallback
- Reconstruit panier 100% identique
- Crée BookEntry (flux inchangé)

---

### **ÉTAPE 10 : Affiche Bannière Succès**

```html
<!-- Template -->
@if (showSuccessBanner$ | async as banner) {
  <div class="success-banner">
    <div class="success-content">
      <div class="icon">✅</div>
      <h2>Paiement reçu!</h2>
      
      <div class="receipt">
        <div class="line">
          <span>Montant:</span>
          <strong>{{ banner.total | currency }}</strong>
        </div>
        <div class="line">
          <span>Session:</span>
          <code>{{ banner.sessionId }}</code>
        </div>
      </div>

      <a [href]="banner.receiptLink" target="_blank" class="btn-primary">
        📄 Télécharger Reçu PDF (Stripe)
      </a>
      
      <button (click)="dismissSuccessAndContinue()" class="btn-secondary">
        Nouvelle vente
      </button>
    </div>
  </div>
}
```

---

## ⏱️ **Timeline Réel - Utilisateur Expérience**

```
T+0s   │ Vendeur clique "Générer QR"
T+0.5s │ Lambda valide + appelle Stripe
T+1s   │ QR affiché, "En attente paiement..."
       │
       ├─── CLIENT PREND SON TÉLÉPHONE ───
       │
T+2s   │ Client scanne QR code
T+3s   │ Stripe page chargée
T+15s  │ Client saisit carte
T+20s  │ 3D Secure (optionnel)
T+25s  │ Stripe success page → Redirige
T+26s  │ Shop détecte retour
       │
       ├─── BACKEND EN ARRIÈRE-PLAN ───
       │
T+30s  │ Webhook Stripe reçu
T+31s  │ DB marque completed
T+32s  │ Spinner "Confirmation..."
T+35s  │ Frontend détecte + fetch receipt
T+36s  │ BookEntry créée
T+37s  │ Bannière SUCCESS affichée
       │
       ├─── TEMPS TOTAL: 37 secondes ───
       │    (réaliste: 20-30s)
```

---

## 📊 **État Machine - Transitions**

```
┌──────────────┐
│    INITIAL   │
└──────┬───────┘
       │ Clique "Générer QR"
       ▼
┌──────────────────────────┐
│  GENERATING_QR           │
│  (Lambda en cours)       │
└──────┬───────────────────┘
       │ sessionId + URL retourné
       ▼
┌──────────────────────────┐
│  SHOWING_QR_MODAL        │◄────── Peut rester ici longtemps
│  "En attente paiement"   │        (client pas pressé)
│  Timer: 24h              │
└──────┬───────────────────┘
       │ Client revient de Stripe
       ▼
┌──────────────────────────┐
│  DETECTED_RETURN         │
│  sessionId match ✅      │
└──────┬───────────────────┘
       │ Spinner "Confirmation..."
       ▼
┌──────────────────────────┐
│  WEBHOOK_RECEIVED        │
│  DB marked completed     │
│  Receipt URL fetched     │
└──────┬───────────────────┘
       │ Reconstructs panier
       │ Creates BookEntry
       ▼
┌──────────────────────────┐
│  SUCCESS                 │
│  Bannière + reçu affiché │
└──────┬───────────────────┘
       │ Dismiss
       ▼
┌──────────────────────────┐
│  READY_FOR_NEXT_SALE     │
│  Panier reset            │
└──────────────────────────┘
```

---

## 🔧 **Fichiers à Modifier/Créer**

### **Modifications Légères**

```
projects/admin/src/app/back/shop/
├── shop.component.ts
│   └─ Ajouter:
│      • onGenerateInvoiceQR()
│      • setupCheckoutCompletion()
│      • onCheckoutCompleted()
│      • sessionStorage management
│
├── shop.component.html
│   └─ Ajouter:
│      • Bouton "Générer QR"
│      • Modal QR avec statuts
│      • Bannière succès
│
└── (Aucun nouveau fichier service)
```

### **Migrations DynamoDB**

```
✅ AUCUNE!

Schéma StripeTransaction EXISTANT supporte:
  ├─ sessionId ✓
  ├─ cartSnapshot ✓
  ├─ debtAmountCents ✓
  ├─ assetAmountCents ✓
  ├─ status ✓
  └─ metadata JSON ✓
```

### **Dépendances NPM à Ajouter**

```json
{
  "devDependencies": {
    "qrcode": "^1.5.3",      // Génération QR
    "ngx-qrcode2": "^14.0.0" // EN OPTION: composant Angular
  }
}
```

---

## 🎯 **Checklist Implémentation (2-3 jours)**

### **J1 - Matin: Préparation**
- [ ] Ajouter lib QRCode au `package.json`
- [ ] Design modal QR (Figma ou directement SCSS)
- [ ] Vérifier paramètres URL retour Stripe

### **J1 - Après-midi: Frontend Template**
- [ ] Implémenter modal QR (template + state)
- [ ] Ajouter bouton "Générer QR"
- [ ] Styling bannière succès
- [ ] Template pour spinner "Confirmation"

### **J2 - Matin: Backend Intégration**
- [ ] Ajouter sessionStorage management dans component
- [ ] Implémenter `onGenerateInvoiceQR()`
- [ ] Setup Firestore listener OU polling
- [ ] Tester localStorage match

### **J2 - Après-midi: Completion Flow**
- [ ] Implémenter `onCheckoutCompleted()`
- [ ] Intégrer avec CartService.save_sale()
- [ ] Fetch receipt URL depuis Stripe
- [ ] Reset panier + sessionStorage cleanup

### **J3 - Matin: Tests**
- [ ] Test fluxe complet en dev mode
- [ ] Simuler timeout client (modal reste ouverte 30 min)
- [ ] Tester XSS (sessionId + query params)
- [ ] Vérifier webhook reception
- [ ] Vérifier BookEntry création

### **J3 - Après-midi: Polish**
- [ ] Gestion erreurs (retry logic)
- [ ] Toast messages
- [ ] Dark mode CSS
- [ ] Déploiement staging

### **V0fter: Production**
- [ ] Code review
- [ ] QA validation
- [ ] Amplify deploy
- [ ] Monitor logs 48h

---

## 💰 **Coûts & Gains**

### **Coûts d'Implémentation**
- Matériel: **0€** (aucun TPE)
- Infrastructure: **0€** (réutilise Lambda existant)
- Développement: **2-3 jours**

### **Coûts Récurrents**
- Stripe fees: **2.9% + 0.30€ / transaction** (identique à online)
- AWS Lambda: **Gratuit** (tierée, réutilisé)
- Hébergement: **Zéro ajout**

### **Gains Immédiats**
✅ Paiements sans saisie manuelle montant  
✅ Consolidation 100% Stripe (1 seul relevé)  
✅ Réconciliation auto (webhooks)  
✅ Reçu Stripe PDF automatique  
✅ Auditabilité intégrale  

### **Gains Futurs**
✅ Possible intégrer SumUp after (fallback)  
✅ Possibilité paiements récurrents (abonnement)  
✅ Split payments (si besoin)  

---

## ⚠️ **Risques & Mitigations**

| Risque | Probabilité | Mitigation |
|--------|-------------|-----------|
| SessionStorage du client nettoyé | Faible | StripeTransaction TB sauvegarde session |
| Client ferme navigateur (T+26s) | Moyenne | Polling/listener détecte webhook |
| Stripe webhook delay > 30s | Faible | Polling max 2s en fallback |
| XSS injection sessionId | Très faible | Validation stricte + temporal check |
| 3D Secure failure = annulation | Faible | Montrants reviennent, client peut relancer |
| Circuit internet instable | Moyenne | Webhook + modal reste ouverte 24h |

---

## 🚀 **Plan de Déploiement**

### **Canary Deployment**
1. **Staging**: Déployer en dev 24h (test interne)
2. **Beta**: 5% des utilisateurs (24-48h)
3. **Prod**: 100% après validation

### **Rollback Plan**
- **Instant**: Cache bust frontend (zéro DB migration)
- **Impact**: Zéro (modal disparaît, boutique continue)
- **Temps**: < 5 min

### **Monitoring Post-Deploy**
```
Métriques à surveiller:
├─ Webhook delivery rate (% < 100%)
├─ BookEntry creation success rate
├─ StripeTransaction status distribution
├─ Session validation failures
├─ Error rate in logs
└─ 3D Secure decline rate
```

---

## 📚 **Appendix: Code Boilerplate**

### **Service à Créer (Optionnel)**

```typescript
// stripe-invoice-qr.service.ts
@Injectable()
export class StripeInvoiceQRService {
  
  async generateQR(params: {
    cartItems: CartItem[];
    debtAmount?: number;
    assetAmount?: number;
    buyerName?: string;
  }): Promise<InvoiceQRResult> {
    const response = await this.api.post('/stripe-checkout', {
      productIds: params.cartItems.map(i => i.id),
      quantities: params.cartItems.map(i => i.quantity),
      debtAmountCents: (params.debtAmount || 0) * 100,
      assetAmountCents: (params.assetAmount || 0) * 100,
      memberName: params.buyerName,
      cartSnapshot: params.cartItems,
      invoiceMode: true
    });
    
    return {
      qrUrl: response.sessionUrl,
      sessionId: response.sessionId,
      expiresAt: Date.now() + 24*3600*1000
    };
  }
  
  validateSessionId(sessionId: string, stored: string): boolean {
    return sessionId === stored && this.checkSessionAge(stored);
  }
  
  private checkSessionAge(sessionId: string): boolean {
    const age = Date.now() - (parseInt(sessionId) || 0);
    return age < 24 * 3600 * 1000; // 24h max
  }
}
```

---

## 🎓 **Learnings & Best Practices**

### **De l'expérience Stripe Online (déployé)**
- ✅ Lambda validation = zéro bugs montants
- ✅ StripeTransaction snapshot = réconciliation totale
- ✅ Webhook + polling = robustesse sur réseau instable
- ✅ sessionStorage match = sécurité XSS

### **Pour QR Invoice (nouveau)**
- ✅ Réutiliser striipe-checkout → coût minimal
- ✅ QR = zéro infra physique ajoutée
- ✅ Client scanne = UX naturelle (pas clic bouton)
- ✅ 24h expiration = évite saturation DB

---

## 📞 **Support & Questions**

### **FAQ**

**Q: Pourquoi pas Stripe Terminal M2?**  
A: Indisponible en France. Verifone M440 surdimensionné + cher.

**Q: Client refuse de scanner?**  
A: Fallback: Imprimer code + URL en tant que QR immuable sur reçu précédent.

**Q: Stripe webhook delayed?**  
A: Polling toutes les 2s en fallback = max 30s d'attente avant BookEntry.

**Q: Schema DynamoDB change?**  
A: Non! StripeTransaction EXISTANT couvre tous les champs nécessaires.

**Q: Coût supplémentaire?**  
A: **0€**. Réutilise infrastructure existante + Stripe fees standards.

---

## ✅ **Status Final**

🟢 **Solution approuvée**  
🟢 **Architecture validée**  
🟢 **Aucune blocker identifié**  
🟡 **À implémenter après dashboard**  
🟢 **Temps d'implémentation réaliste: 2-3 jours**  

**Prochaine étape:** Lancer spécification techniques + UI design.

---

**Document créé:** 1er Avril 2026  
**Auteur:** GitHub Copilot  
**Version:** 1.0 - APPROUVÉ POUR IMPLÉMENTATION  

---

*Ce document peut être imprimé en PDF via VS Code (Print to PDF) ou exporté via Markdown to PDF.*
