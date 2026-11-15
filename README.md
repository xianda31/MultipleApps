# MultipleApps

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 18.1.3.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

### Admin maintenance configuration on a new development machine

The local [Admin development environment](projects/admin/src/environments/environment.development.ts) is ignored by Git. When recreating it from [environment.ts](projects/admin/src/environments/environment.ts), keep the `maintenanceTargets` import and spread from [maintenance-targets.ts](projects/admin/src/environments/maintenance-targets.ts). This versioned file contains the non-secret Production/Sandbox DynamoDB identifiers used by CloneDB and Book Backup; update it when the target backends change. The PPTPE environment does not configure Admin maintenance.

CloneDB uses temporary credentials from the logged-in Amplify/Cognito session, not the local AWS CLI profile. Its session must allow DynamoDB listing and descriptions in the configured region. Loading failures and unmatched target identifiers are displayed explicitly; listing tables does not clone or delete data.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

### Shared tournament check-ins

The `unpointed` check-in mode is distinct from `none` (offered). Older clients
interpret `unpointed` as a card check-in: update and reload every operator
station before using cancellation.

The preferred payment method is configured per fee rate (standard / summer) in
**System configuration > Table fees**, stored as `fee_rates[].payment_preference`.
Reload other stations after saving system settings. Older configurations default
to Card; previous per-tournament preferences are no longer used.
The preference only controls manual
check-in clicks: EUR records a euro payment directly, while Card still requires
sufficient credits (otherwise the options menu opens). Existing check-ins and
NFC card check-ins are unchanged.
Changing the tournament fee rate also changes its preferred payment method;
operators are warned when this affects a tournament with existing check-ins.
The missing-players filter works with both pair order and alphabetical order.
On phones, player cards use one column in portrait and a compact two- or
three-column layout in landscape, with options menus rendered outside the cards.

### Managing imported tournament pairs

The **Gérer les paires** footer button edits the persisted local player list only;
FFB registrations are never changed. Operators can add two players together,
replace one player while retaining their partner, or remove a whole pair.
A replacement starts unchecked. The outgoing player must be unchecked before
replacement, and both players must be unchecked before removing a pair.
Duplicate players, closed tournaments and stale edits are rejected.
Legacy lists retain their original pair positions, including incomplete pairs.

Deploy the backend changes (including `Game.playersVersion`, `mutateGamePlayers`,
and its subscription resolver) before publishing the updated frontend, then
reload **every operator station**. Old clients can still overwrite player lists
outside the new transaction. New clients update the player list and check-in
atomically, with settlement and version checks. `onGamePlayersChanged` requires
an explicit AppSync handler; its server-side filter isolates each tournament.
The backend restricts this handler's CDK dependencies to the GraphQL schema and
NONE data source: the installed Amplify JS-resolver generator otherwise adds
invalid references to resources inside nested model stacks. Its local synthesis
regression test is `npx tsx --test amplify/data/game-players-subscription.test.ts`.
Direct DynamoDB writes and Lambda responses must keep `Game.gamers` as a native
JSON array, not a string containing JSON. Readers also accept previously encoded
lists, so existing saved replacements can be resumed without replaying them.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Architecture notes (standalone)

- The app uses Angular standalone components (Angular 15+) across front and back.
- Back area is lazy-loaded directly from the routes array:
	- See `projects/admin/src/app/app.routes.ts` and `projects/admin/src/app/back/back.routes.ts`.
	- `BackModule` was removed; each back component declares its own `imports`.
- Front keeps a minimal `FrontModule` only to provide dynamic routes via `ROUTES` and `DynamicRoutesService`.
- Common pipes are standalone and also bundled in `SharedModule` for convenience in module-based contexts.

Tips:
- When adding a new component, prefer `standalone: true` and list required imports in its decorator.
- For new back routes, just add to `back/back.routes.ts` and import the standalone component.
