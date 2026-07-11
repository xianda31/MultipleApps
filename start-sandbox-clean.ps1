#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Clean sandbox startup - kills all processes, clears artifacts, starts sandbox once
.DESCRIPTION
    This script ensures a clean Amplify sandbox startup without watch-triggered conflicts
#>

Write-Host "🧹 Cleaning up..." -ForegroundColor Cyan

# 1. Kill only sandbox/ampx processes (not ng serve!)
Write-Host "  → Killing sandbox processes (keeping ng serve)..."
Get-Process npm -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*sandbox*" -or $_.CommandLine -like "*ampx*"
} | Stop-Process -Force -ErrorAction SilentlyContinue

# Also kill any stray ampx processes
Get-Process | Where-Object {
    $_.ProcessName -like "*ampx*" -or $_.ProcessName -like "*aws-cdk*"
} | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Milliseconds 500

# 2. Clean ALL CDK/Amplify artifacts (complete wipe)
Write-Host "  → Cleaning CDK & Amplify artifacts..."
Remove-Item -Path ".amplify" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "amplify_outputs.json" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "amplify/.amplify" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "amplify/amplify_outputs.json" -Force -ErrorAction SilentlyContinue

# 3. Wait for file system to fully settle
Write-Host "  → Waiting for file system to settle..."
Start-Sleep -Seconds 2

# Remove stale CDK read locks that can trigger false MultipleSandboxInstancesError
Get-ChildItem -Path ".amplify/artifacts/cdk.out" -Filter "read.*.lock" -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

# 4. Launch sandbox - it will run indefinitely until Ctrl+C
Write-Host "`n▶️  Starting Amplify Sandbox (profile: amplify-dev, identifier: toto)" -ForegroundColor Green
Write-Host "   Sandbox is running - press Ctrl+C to stop" -ForegroundColor Gray
Write-Host "   Logs: CloudWatch under stack amplify-multipleapps-toto-sandbox-*`n" -ForegroundColor Gray

# Run sandbox and let it stay running
npm run sandbox
