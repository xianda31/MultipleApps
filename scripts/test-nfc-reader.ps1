param(
    [string]$ReaderName = "",
    [ValidateRange(1, 1000)]
    [int]$Count = 1,
    [switch]$ListReaders,
    [switch]$Beep
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not ("NfcDiagnostic.PresenceReader" -as [type])) {
    Add-Type -Path (Join-Path $PSScriptRoot '..\desktop\ppNFC\PcscReader.cs')
}

$pcsc = New-Object NfcDiagnostic.PresenceReader
try {
    $readers = @($pcsc.ListReaders())
    if ($ListReaders) {
        $readers
        return
    }

    if (-not $ReaderName) {
        $candidates = @($readers | Where-Object { $_ -like "*ACR1555*PICC*" })
        if ($candidates.Count -ne 1) {
            throw "Expected one ACR1555 PICC reader, found $($candidates.Count). Use -ListReaders, then -ReaderName."
        }
        $ReaderName = $candidates[0]
    }
    if ($ReaderName -notin $readers) {
        throw "Reader not found: $ReaderName"
    }

    Write-Host "Reader: $ReaderName"
    if ($Beep) {
        $pcsc.Beep($ReaderName)
        Write-Output "Reader acknowledged a 200 ms buzzer command. Confirm the sound physically."
        return
    }
    Write-Host "Present a card. Remove it between readings. Ctrl+C to stop."
    $present = $false
    $readings = 0
    $recoveryStarted = $null
    while ($readings -lt $Count) {
        try {
            if (-not $pcsc.IsCardPresent($ReaderName)) {
                $present = $false
            } elseif (-not $present) {
                $uid = $pcsc.ReadUid($ReaderName)
                if ($null -ne $uid) {
                    $readings++
                    Write-Output ("{0:HH:mm:ss.fff} [{1}/{2}] UID={3} ({4} bytes)" -f (Get-Date), $readings, $Count, $uid, ($uid.Length / 2))
                    $present = $true
                }
            }
            if ($null -ne $recoveryStarted) {
                Write-Warning "Reader available again. Remove the card before presenting it again."
                $recoveryStarted = $null
            }
        } catch {
            $failure = $_.Exception
            while ($null -ne $failure.InnerException) {
                $failure = $failure.InnerException
            }
            if ($failure -isnot [NfcDiagnostic.PcscException] -or $failure.Code -ne 0x80100017L) {
                throw
            }
            if ($null -eq $recoveryStarted) {
                $recoveryStarted = [DateTime]::UtcNow
                Write-Warning "$($failure.Message). Waiting up to 10 seconds for recovery; this presentation is not counted. Remove the card."
                $present = $true
            }
            if (([DateTime]::UtcNow - $recoveryStarted).TotalSeconds -ge 10) {
                throw "Reader unavailable for 10 seconds. Check its Online status in ACS Bluetooth Reader Management Tool. Last error: $($failure.Message)"
            }
        }
        if ($readings -lt $Count) {
            Start-Sleep -Milliseconds 200
        }
    }
} finally {
    $pcsc.Dispose()
}
