. (Join-Path $PSScriptRoot 'common.ps1')

$creator = Find-CocosCreator
if (-not $creator) {
    throw 'Cocos Creator 3.8.8 was not found. Install it from Cocos Dashboard first.'
}

if (Get-Process -Name CocosCreator -ErrorAction SilentlyContinue) {
    throw 'Cocos Creator is already running. Close the editor before using pnpm.cmd cocos:build:web, then retry.'
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$project = Join-Path $repoRoot 'apps\game-client'
$output = Join-Path $project 'build\web-desktop\index.html'
# The mobile template fills the browser viewport. The desktop template emits a
# fixed 4:3 canvas with a title and footer, which hides the bottom action bar
# when we use the Web build to validate the landscape mini-game layout.
$buildOptions = 'platform=web-mobile;debug=false;buildPath=project://build;outputName=web-desktop'

Write-Host "Building Cocos web preview: $project"
$process = Start-Process -FilePath $creator -ArgumentList @(
    '--project',
    $project,
    '--build',
    $buildOptions
) -PassThru -WindowStyle Hidden
$process.WaitForExit()

# Cocos Creator documents 36 as the successful command-line build exit code.
if ($process.ExitCode -notin @(0, 36)) {
    throw "Cocos build failed with exit code $($process.ExitCode). Check apps/game-client/temp/logs/project.log."
}
if (-not (Test-Path -LiteralPath $output)) {
    throw "Cocos exited successfully but the expected output is missing: $output"
}

Write-Host "Cocos web build succeeded: $output"
