param(
    [string]$DeviceId,
    [string]$ApkPath = "android/app/build/outputs/apk/debug/app-debug.apk",
    [string]$RemoteNamePrefix = "wisepad-refresh",
    [switch]$BuildApk,
    [switch]$Release
)

$ErrorActionPreference = "Stop"

function Require-Command {
    param([string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Missing required command: $Name"
    }
}

function Invoke-Checked {
    param(
        [string]$Command,
        [string[]]$Arguments,
        [string]$WorkingDirectory
    )

    Push-Location $WorkingDirectory
    try {
        & $Command @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed with exit code ${LASTEXITCODE}: $Command $($Arguments -join ' ')"
        }
    }
    finally {
        Pop-Location
    }
}

function Resolve-DeviceId {
    param([string]$RequestedDeviceId)

    if ($RequestedDeviceId) {
        return $RequestedDeviceId
    }

    $devices = @(
        adb devices |
            Select-String "^\S+\s+device$" |
            ForEach-Object { (($_.Line -split "\s+")[0]).Trim() }
    )

    if (-not $devices -or $devices.Count -eq 0) {
        throw "No Android device detected (adb devices)."
    }

    if ($devices.Count -gt 1) {
        throw "Multiple Android devices detected. Re-run with -DeviceId <serial>."
    }

    return [string]$devices[0]
}

Require-Command "adb"

if ($BuildApk) {
    Require-Command "npm"
    Require-Command "npx"

    Write-Host "Building ppTPE web assets..."
    Invoke-Checked -Command "npm" -Arguments @("run", "ng", "--", "build", "pptpe", "--configuration", "production") -WorkingDirectory $PSScriptRoot\..

    Write-Host "Syncing Capacitor Android project..."
    Invoke-Checked -Command "npx" -Arguments @("cap", "sync", "android") -WorkingDirectory $PSScriptRoot\..

    $gradleTask = if ($Release) { "assembleRelease" } else { "assembleDebug" }
    $buildKind = if ($Release) { "release" } else { "debug" }
    Write-Host "Assembling Android $buildKind APK..."
    Invoke-Checked -Command ".\gradlew.bat" -Arguments @($gradleTask) -WorkingDirectory $PSScriptRoot\..\android

    if ($Release -and $ApkPath -eq "android/app/build/outputs/apk/debug/app-debug.apk") {
        $signedReleaseApk = "android/app/build/outputs/apk/release/app-release.apk"
        $unsignedReleaseApk = "android/app/build/outputs/apk/release/app-release-unsigned.apk"
        if (Test-Path $signedReleaseApk) {
            $ApkPath = $signedReleaseApk
        }
        elseif (Test-Path $unsignedReleaseApk) {
            $ApkPath = $unsignedReleaseApk
        }
        else {
            $ApkPath = $signedReleaseApk
        }
    }
}

if (-not (Test-Path $ApkPath)) {
    throw "APK not found: $ApkPath"
}

$resolvedDeviceId = Resolve-DeviceId -RequestedDeviceId $DeviceId
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$remoteName = "$RemoteNamePrefix-$stamp.apk"
$remotePath = "/sdcard/Download/$remoteName"

Write-Host "Using device: $resolvedDeviceId"
Write-Host "Local APK: $ApkPath"
Write-Host "Remote APK: $remotePath"

adb -s "$resolvedDeviceId" push $ApkPath $remotePath | Out-Host
adb -s "$resolvedDeviceId" shell "ls -la $remotePath" | Out-Host

# Trigger media scan so file managers can refresh quicker.
adb -s "$resolvedDeviceId" shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d "file://$remotePath" | Out-Host

# Open Android package installer directly on the copied APK.
adb -s "$resolvedDeviceId" shell am start -n com.google.android.packageinstaller/com.android.packageinstaller.InstallStart -a android.intent.action.VIEW -d "file://$remotePath" -t "application/vnd.android.package-archive" --grant-read-uri-permission | Out-Host

Write-Host ""
Write-Host "Installer launched. Confirm installation on the tablet screen."
Write-Host "If needed, open manually: $remotePath"
