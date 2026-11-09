# Changelog

All notable changes to this project will be documented in this file.

## Unreleased
### Fixed
- CloneDB: restore Production/Sandbox identifiers in the local Admin environment and share non-secret maintenance targets through a versioned configuration. Filter target tables before describing them, report missing tables and AWS failures explicitly, and release the loading state instead of leaving an empty directory.
- Member directory: show cached/AWS members while synchronization runs, publish stable snapshots after each phase, and keep filters and sorting usable. Editing and export stay disabled until completion; failed scans retain the displayed directory with an explicit incomplete-data warning and a retry action.
- Member directory: reuse a successful synchronization for the selected season throughout the application session, including member-sales navigation. Changing season or using the directory's Actualiser button runs a full scan with a fresh FFB club list; failed or interrupted scans remain retryable. Reloading the application starts a new synchronization session.
- Member synchronization: reload the AWS directory before matching FFB identities, abort if that reload fails, and refresh the working snapshot after each member to avoid recreating members from a stale session or repeated FFB entries. Existing production duplicates are not deleted automatically.
- Used-account filtering: returning from the full grid removes empty/zero fields, keeps non-successive used accounts adjacent in display order, and retains invalid inputs for correction without changing accounting values.
- Additional-account selector: show a plus above a read-only “autre compte” placeholder; hide the selector and return no available accounts while the full grid is displayed.
- Accounting editor: append newly selected accounts to the right in selection order, without changing their underlying accounting indices.
- Accounting editor: existing operations show only non-zero expense/revenue accounts, with an inline account selector aligned with account codes and a full-grid toggle. Added or cleared fields remain visible during editing without a removal button; empty accounts are hidden when reopening. Creation is unchanged and closed-season accounts stay read-only.
- Accounting operation identity: use the same top-aligned column for the member of nominative transactions and the label of non-nominative transactions.
- BookEntry JSON: display compact JSON by default, with a switch to enable or disable indentation on demand.
- Nominative accounting entries: keep the automatically populated operation label hidden in the editor for both current and closed seasons; retain the stored trace and its visibility in the raw JSON.
- Accounting editor: open the compact form directly, retain account codes/tooltips, highlight changed fields and keep balance/actions visible. Only accounting changes require confirmation; authorized documentary edits bypass audit. Closed seasons use the same layout with accounting fields disabled. Invoice references are saved with the form without deleting supporting files; technical JSON remains directly visible, and payment metadata/purchased items are preserved.
- Past-season accounting documentation: Administrateur and System can edit operation labels, tags and invoice references without changing or auditing accounting values. Dates, beneficiaries, accounts, amounts, bank pointing, payment references and purchased items remain locked; future/unopened seasons remain read-only.
- Online shop: initialize debt and assets together after accounting synchronization, block checkout while balances are unavailable, and re-read server balances before Stripe; changed balances update the cart and require a new confirmation. Debt-only payments have no purchased items and create no playbook.
- Tournament registration: report missing member FFB IDs, show pending team submissions, revalidate partners when registered teams change, and display FFB rejection reasons directly in the page (including registrations managed by the organizer).
- Team registration stops at the first failed POST (no automatic retries), logs the error once, and groups identical per-player rejection reasons in the page.
- Confirmation dialogs: preserve button identity and focus during Angular refreshes, including the fees-collector settlement confirmation.
- Amplify sandbox: pin Zod to 3.25.17 so `amplify_outputs.json` can be generated.
- Shop: changing the sale date preserves the buyer and cart, updates the session season, rejects invalid dates, and is disabled during payment/save.
- Present sales: buyer search uses the local member list without triggering FFB synchronization (including external-license lookups). Full synchronization remains in member management. The list continues receiving member updates, displays its loading state, and reports loading failures; accounting checks remain unchanged.
- Books editor: received member transfers retain their bank receipt in protected mode, display "VIREMENT", and allow debt-only settlements without requiring a product amount. Announced transfers remain unpaid member debts; the balance check is unchanged.
- Books editor: member cheque purchases support granting an asset (`avoir_out`, displayed as "Somme mise en avoir"). Customer balance fields use explicit labels ("Avoir utilisé", "Dette remboursée", "Reste dû", "Somme mise en avoir") in a separate payment section. The existing balance check remains the only balance indicator. No additional correction-description field is needed. Existing cheque labels, operation product codes and calculated totals are preserved when editing.
- Books editor: the total for an announced member transfer is now recorded globally on the second line. The first operation identifies the payer, while `Avoir utilisé`, `Dette remboursée`, and `Somme mise en avoir` are grouped under member-balance adjustments. Existing operation-level transfer promises remain readable and are migrated when edited.
- To regularize a 60 EUR cheque recorded for one 30 EUR card: first verify that the second card is missing, then correct the existing cheque receipt to 60 EUR with `CAR: 30` and "Somme mise en avoir": 30 for the payer. Purchase the missing card through the shop using the 30 EUR asset (zero additional payment); do not create it manually. Use the tag to cross-reference the entries if needed. Finally verify two cards, 60 EUR of card revenue, no residual asset from the correction, and the cheque deposit total. Editing the receipt does not update an already recorded deposit.

## [1.0.0] - 2025-11-10
### Added
- Menu Manager (menus-editor): parent & child drag-and-drop with rank persistence, auto slug & path generation, page title enrichment, sandbox toggle.
- Standalone migration of all back-office components (finance, shop, members, maintenance, files) eliminating BackModule.
- Dynamic front routes via `DynamicRoutesService` with `ROUTES` provider.
- NavItem utilities: `charsanitize`, `buildFullPath`, `extractSegment` + unit tests.
- Sandbox mode indicator and service controlling dynamic route sets.
- New authentication `ConnexionPageComponent` and refactored `ConnexionComponent` usage.
- S3 clone tool (`CloneS3Component`) and DB clone improvements.

### Changed
- Routing: back lazy-loaded via direct routes array (`back.routes.ts`); front kept minimal module for dynamic routes provider.
- Shared pipes converted to standalone (e.g. `ParenthesisPipe`, `TruncatePipe`, `MoveToEndPipe`).
- Navbar components (front & back) updated for handle-only drag interactions and sandbox display.
- Removed legacy `menus.service` replaced by `navitem.service` unified logic.

### Removed
- `BackModule` (replaced by standalone components + direct route lazy load).

### Fixed
- NG8001 errors due to mixed module/standalone declarations resolved by full standalone adoption.
- Various template minor cleanups (optional chaining removal in books editor date field, improved cheque handling).

### Internal
- Amplify resource adjustments and graphQL service updates for navitem handling.
- README updated with architecture notes on standalone approach.

## Previous (pre-1.0.0)
- Initial Angular CLI scaffold and incremental feature additions (not tracked in this changelog).

---

### Release tagging procedure (for future reference)
1. Ensure all changes merged into `master`.
2. Update `package.json` version.
3. Update `CHANGELOG.md`.
4. Commit with message `chore(release): x.y.z`.
5. Create annotated tag `vX.Y.Z`.
6. Push commit and tag.
