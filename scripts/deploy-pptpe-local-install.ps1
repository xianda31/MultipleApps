param(
    [string]$DeviceId,
    [string]$ApkPath = "android/app/build/outputs/apk/debug/app-debug.apk",
    [string]$RemoteNamePrefix = "wisepad-refresh"
)

$ErrorActionPreference = "Stop"

function Require-Command {
    param([string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Missing required command: $Name"
    }
}

function Resolve-DeviceId {
    param([string]$RequestedDeviceId)

    if ($RequestedDeviceId) {
        return $RequestedDeviceId
    }

    $devices = adb devices | Select-String "\tdevice$" | ForEach-Object {
        ($_ -split "`t")[0].Trim()
    }

    if (-not $devices -or $devices.Count -eq 0) {
        throw "No Android device detected (adb devices)."
    }

    if ($devices.Count -gt 1) {
        throw "Multiple Android devices detected. Re-run with -DeviceId <serial>."
    }

    return $devices[0]
}

Require-Command "adb"

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

adb -s $resolvedDeviceId push $ApkPath $remotePath | Out-Host
adb -s $resolvedDeviceId shell "ls -la $remotePath" | Out-Host

# Trigger media scan so file managers can refresh quicker.
adb -s $resolvedDeviceId shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d "file://$remotePath" | Out-Host

# Open Android package installer directly on the copied APK.
adb -s $resolvedDeviceId shell am start -n com.google.android.packageinstaller/com.android.packageinstaller.InstallStart -a android.intent.action.VIEW -d "file://$remotePath" -t "application/vnd.android.package-archive" --grant-read-uri-permission | Out-Host

Write-Host ""
Write-Host "Installer launched. Confirm installation on the tablet screen."
Write-Host "If needed, open manually: $remotePath"
