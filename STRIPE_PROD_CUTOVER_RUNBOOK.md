# Stripe Production Cutover Runbook

This runbook covers two goals:

1. Clean up duplicated Stripe SSM parameters safely.
2. Cut over production from Stripe test mode to Stripe live mode.

All commands below are PowerShell-friendly on Windows.

## Scope and constants

- AWS profile: `amplify-dev`
- AWS region: `eu-west-3`
- Amplify app id: `d129hzsf6g08ma`
- Production branch id: `master-branch-d5c7f4aebb`

Derived branch path:

- `/amplify/d129hzsf6g08ma/master-branch-d5c7f4aebb`

Expected production keys:

- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`

## Phase 0 - Preconditions

1. Stripe dashboard live account ready.
2. Live webhook endpoint created for production API URL.
3. Live webhook events enabled:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. You have the three live values:
   - `sk_live_...`
   - `pk_live_...`
   - `whsec_live_...`

## Phase 1 - Audit current SSM keys (no deletion)

Run:

```powershell
./scripts/stripe-ssm-audit-cleanup.ps1 -Profile amplify-dev -Region eu-west-3 -AppId d129hzsf6g08ma -BranchId master-branch-d5c7f4aebb
```

What to check in output:

1. `ExpectedBranch = True` for the 3 expected branch keys.
2. `Type = SecureString` for all keys.
3. No unexpected `DeleteCandidate = True` on the 3 expected branch keys.

## Phase 2 - Put production live secrets

Set live keys on expected branch path:

```powershell
aws ssm put-parameter --region eu-west-3 --profile amplify-dev --type SecureString --overwrite --name "/amplify/d129hzsf6g08ma/master-branch-d5c7f4aebb/STRIPE_SECRET_KEY" --value "sk_live_..."
aws ssm put-parameter --region eu-west-3 --profile amplify-dev --type SecureString --overwrite --name "/amplify/d129hzsf6g08ma/master-branch-d5c7f4aebb/STRIPE_PUBLISHABLE_KEY" --value "pk_live_..."
aws ssm put-parameter --region eu-west-3 --profile amplify-dev --type SecureString --overwrite --name "/amplify/d129hzsf6g08ma/master-branch-d5c7f4aebb/STRIPE_WEBHOOK_SECRET" --value "whsec_live_..."
```

Verify only prefixes (do not share full values):

```powershell
aws ssm get-parameter --region eu-west-3 --profile amplify-dev --name "/amplify/d129hzsf6g08ma/master-branch-d5c7f4aebb/STRIPE_SECRET_KEY" --with-decryption --query "Parameter.Value" --output text
aws ssm get-parameter --region eu-west-3 --profile amplify-dev --name "/amplify/d129hzsf6g08ma/master-branch-d5c7f4aebb/STRIPE_PUBLISHABLE_KEY" --with-decryption --query "Parameter.Value" --output text
aws ssm get-parameter --region eu-west-3 --profile amplify-dev --name "/amplify/d129hzsf6g08ma/master-branch-d5c7f4aebb/STRIPE_WEBHOOK_SECRET" --with-decryption --query "Parameter.Value" --output text
```

Expected prefixes:

- `sk_live_`
- `pk_live_`
- `whsec_live_`

## Phase 3 - Runtime refresh and smoke tests

Secrets are read at Lambda cold start. Trigger fresh execution by invoking each flow once:

1. Online checkout test purchase in production UI.
2. Terminal payment from production path.
3. Confirm webhook receives live event and writes expected records.

Must-pass checks:

1. Stripe dashboard shows live transactions.
2. API returns no `STRIPE_WEBHOOK_SECRET not configured`.
3. Book entries and Stripe transactions are created as expected.

## Phase 4 - Cleanup legacy keys (safe sequence)

1. Re-run audit and export output.
2. Keep only keys referenced by production lambdas and branch expected keys.
3. Delete only candidates reported by audit script.

Preview candidates:

```powershell
./scripts/stripe-ssm-audit-cleanup.ps1 -Profile amplify-dev -Region eu-west-3 -AppId d129hzsf6g08ma -BranchId master-branch-d5c7f4aebb
```

Delete candidates:

```powershell
./scripts/stripe-ssm-audit-cleanup.ps1 -Profile amplify-dev -Region eu-west-3 -AppId d129hzsf6g08ma -BranchId master-branch-d5c7f4aebb -DeleteCandidates
```

## Rollback plan

If production fails after cutover:

1. Put previous known-good test values back on the 3 expected branch keys.
2. Re-run smoke tests.
3. Investigate webhook endpoint mode mismatch (test endpoint used with live key or inverse).

## Security notes

1. Never store Stripe live keys in source files.
2. Keep `STRIPE_WEBHOOK_SECRET` as `SecureString` only.
3. Rotate any exposed AWS access key previously present in frontend environment files.
4. Keep sandbox/dev on Stripe test keys only.
