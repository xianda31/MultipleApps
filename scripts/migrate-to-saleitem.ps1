param(
    [switch]$DryRun,
    [switch]$Force,
    [string]$ProfileName   = "amplify-dev",
    [string]$Region        = "eu-west-3",
    [string]$ProductTable  = "",
    [string]$SaleItemTable = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-TableByPrefix([string]$prefix) {
    $tables = (aws dynamodb list-tables --profile $ProfileName --region $Region --output json | ConvertFrom-Json).TableNames
    $match = @($tables | Where-Object { $_ -like "${prefix}-*" })
    if ($match.Count -eq 0) { throw "No table '${prefix}-*' found." }
    if ($match.Count -gt 1) {
        Write-Warning "Multiple '${prefix}-*' tables found, using: $($match[0])"
    }
    return $match[0]
}

if (-not $ProductTable)  { $ProductTable  = Get-TableByPrefix "Product"  }
if (-not $SaleItemTable) { $SaleItemTable = Get-TableByPrefix "SaleItem" }

Write-Host ""
Write-Host "Source  : $ProductTable"
Write-Host "Target  : $SaleItemTable"
if ($DryRun) {
    Write-Host "Mode    : DRY-RUN (no writes)" -ForegroundColor Yellow
} else {
    Write-Host "Mode    : WRITE" -ForegroundColor Green
}
Write-Host ""

Write-Host "Reading Product table..." -ForegroundColor Cyan
$scanResult = aws dynamodb scan --profile $ProfileName --region $Region --table-name $ProductTable --output json | ConvertFrom-Json
$items = @($scanResult.Items)
Write-Host "  $($items.Count) item(s) found."

$targetCount = (aws dynamodb scan --profile $ProfileName --region $Region --table-name $SaleItemTable --select COUNT --output json | ConvertFrom-Json).Count
if ($targetCount -gt 0) {
    Write-Warning "Target table already has $targetCount item(s)."
    if (-not $DryRun -and -not $Force) {
        $confirm = Read-Host "Continue anyway? (yes/no)"
        if ($confirm -ne "yes") { Write-Host "Aborted."; exit 0 }
    }
}

function ConvertTo-SaleItem($item) {
    $entries = $null
    if ($item.PSObject.Properties['info1']) {
        $raw = $item.info1
        if ($raw.PSObject.Properties['S'] -and $raw.S -ne "") {
            $parsed = 0
            if ([int]::TryParse($raw.S, [ref]$parsed) -and $parsed -gt 0) {
                $entries = $parsed
            }
        }
    }
    return @{
        id            = $item.id.S
        glyph         = $item.glyph.S
        name          = $item.description.S
        description   = $item.description.S
        account       = $item.account.S
        price         = [double]$item.price.N
        entries       = $entries
        paired        = $item.paired.BOOL
        currency      = "EUR"
        stripeEnabled = $false
        active        = $item.active.BOOL
    }
}

$saleItems = @($items | ForEach-Object { ConvertTo-SaleItem $_ })

Write-Host ("-" * 100) -ForegroundColor DarkGray
Write-Host ("{0,-36} {1,-8} {2,-5} {3,-7} {4,-5} {5,-5} {6}" -f "ID","Glyph","Price","Entries","Pair","Actif","Description") -ForegroundColor White
Write-Host ("-" * 100) -ForegroundColor DarkGray
foreach ($s in $saleItems) {
    $e = if ($null -ne $s.entries) { $s.entries } else { "-" }
    Write-Host ("{0,-36} {1,-8} {2,-5} {3,-7} {4,-5} {5,-5} {6}" -f $s.id, $s.glyph, $s.price, $e, $s.paired, $s.active, $s.description)
}
Write-Host ("-" * 100) -ForegroundColor DarkGray
Write-Host ""

if ($DryRun) {
    Write-Host "DRY-RUN complete. Run without -DryRun to apply." -ForegroundColor Yellow
    exit 0
}

$tmpFile = [System.IO.Path]::GetTempFileName() + ".json"
$ok = 0; $err = 0

foreach ($s in $saleItems) {
    $now = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    $dynItem = [ordered]@{
        id            = @{ S    = $s.id }
        glyph         = @{ S    = $s.glyph }
        name          = @{ S    = $s.name }
        description   = @{ S    = $s.description }
        account       = @{ S    = $s.account }
        price         = @{ N    = "$($s.price)" }
        paired        = @{ BOOL = $s.paired }
        currency      = @{ S    = $s.currency }
        stripeEnabled = @{ BOOL = $s.stripeEnabled }
        active        = @{ BOOL = $s.active }
        createdAt     = @{ S    = $now }
        updatedAt     = @{ S    = $now }
        "__typename"  = @{ S    = "SaleItem" }
    }
    if ($null -ne $s.entries) { $dynItem["entries"] = @{ N = "$($s.entries)" } }

    [System.IO.File]::WriteAllText($tmpFile, ($dynItem | ConvertTo-Json -Depth 3), (New-Object System.Text.UTF8Encoding $false))

    $ErrorActionPreference = "Continue"
    $output = aws dynamodb put-item `
        --profile $ProfileName `
        --region $Region `
        --table-name $SaleItemTable `
        --item "file://$tmpFile" `
        --output json 2>&1
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = "Stop"

    if ($exitCode -eq 0) {
        Write-Host "  OK  $($s.glyph) - $($s.description)" -ForegroundColor Green
        $ok++
    } else {
        Write-Host "  ERR $($s.glyph) : $output" -ForegroundColor Red
        $err++
    }
}

Remove-Item $tmpFile -ErrorAction SilentlyContinue
Write-Host ""
Write-Host "Done: $ok written, $err error(s)." -ForegroundColor Cyan