# MultipleApps

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 18.1.3.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

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
