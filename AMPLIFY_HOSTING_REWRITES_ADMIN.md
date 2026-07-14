# Amplify Hosting Rewrites For Admin PWA

This repository version-controls the Amplify Hosting rewrite rules required for Android shortcut/PWA installability.

## Why

If `/manifest.webmanifest` is rewritten to `/index.html`, Android Chrome cannot validate installability and the home-screen shortcut fails.

## Files

- `config/amplify/custom-rules-admin.json`: source-of-truth rewrite rules.
- `scripts/set-amplify-admin-rewrites.ps1`: applies rules with AWS CLI.

## Prerequisites

- AWS CLI installed and configured (`aws configure` or SSO).
- Permission to run `amplify:update-app` for the target app.

## Apply Rules

PowerShell:

```powershell
./scripts/set-amplify-admin-rewrites.ps1 -AppId <AMPLIFY_APP_ID> -Region eu-west-3
```

Preview only:

```powershell
./scripts/set-amplify-admin-rewrites.ps1 -AppId <AMPLIFY_APP_ID> -PreviewOnly
```

## Verify After Redeploy

```powershell
curl.exe --ssl-no-revoke -I -L https://www.bridgeclubsaintorens.fr/manifest.webmanifest
curl.exe --ssl-no-revoke -I -L https://www.bridgeclubsaintorens.fr/ngsw-worker.js
curl.exe --ssl-no-revoke -L https://www.bridgeclubsaintorens.fr/manifest.webmanifest | Select-Object -First 20
```

Expected:

- `/manifest.webmanifest` returns `200` with `Content-Type: application/manifest+json` (or `application/json`).
- Response body is JSON (not HTML).
- `/ngsw-worker.js` returns `200` and `Content-Type: text/javascript`.

## Rollback

In Amplify Console, restore previous rewrite rules manually, or re-run `update-app` with a previous JSON snapshot.
