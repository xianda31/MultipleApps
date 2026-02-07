# Script to patch pdfjs-dist.js in Angular cache to suppress Vite warning
# This adds /* @vite-ignore */ to the dynamic import statement

$cacheFile = ".angular/cache/20.2.2/admin/vite/deps/pdfjs-dist.js"

if (Test-Path $cacheFile) {
    Write-Host "Patching $cacheFile to suppress Vite dynamic import warning..."
    
    $content = Get-Content $cacheFile -Raw
    
    # Replace the dynamic import without @vite-ignore with one that has it
    $pattern = '(?s)(yield import\(\s*/\*webpackIgnore: true\*/\s*)(this\.workerSrc)'
    $replacement = '$1/* @vite-ignore */\n        $2'
    
    $newContent = $content -replace $pattern, $replacement
    
    if ($content -ne $newContent) {
        Set-Content $cacheFile -Value $newContent -NoNewline
        Write-Host "Successfully patched pdfjs-dist.js" -ForegroundColor Green
    } else {
        Write-Host "File already patched or pattern not found" -ForegroundColor Yellow
    }
} else {
    Write-Host "Cache file not found. Run 'ng serve' first to generate the cache." -ForegroundColor Red
}
