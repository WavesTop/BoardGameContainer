$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Push-Location $repo
$previousPort = $env:PORT
$process = $null
try {
    pnpm.cmd --filter @bgc/cloudrun-server build
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    $env:PORT = '3100'
    $process = Start-Process -FilePath (Get-Command node.exe).Source `
        -ArgumentList 'apps/cloudrun-server/dist/index.js' `
        -WorkingDirectory $repo `
        -WindowStyle Hidden `
        -PassThru

    $response = $null
    for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
        try {
            $response = Invoke-RestMethod -Uri 'http://127.0.0.1:3100/healthz' -TimeoutSec 1
            break
        }
        catch {
            Start-Sleep -Milliseconds 250
        }
    }
    if (-not $response -or $response.status -ne 'ok') { throw 'Health check did not become ready' }
    pnpm.cmd exec tsx tools/smoke-client.ts
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host 'Smoke test passed:' ($response | ConvertTo-Json -Compress)
}
finally {
    if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force }
    $env:PORT = $previousPort
    Pop-Location
}
