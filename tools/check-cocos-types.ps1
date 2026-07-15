$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$config = Join-Path $repo 'apps\game-client\temp\tsconfig.cocos.json'

if (-not (Test-Path -LiteralPath $config)) {
    Write-Host 'Cocos typecheck skipped: open apps/game-client with Creator 3.8.8 once to generate temp/tsconfig.cocos.json.'
    exit 0
}

Push-Location $repo
try {
    pnpm.cmd exec tsc --noEmit -p apps/game-client/tsconfig.json
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
