# Changelog

All notable changes to this project will be documented in this file.

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
