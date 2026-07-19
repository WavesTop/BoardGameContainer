. (Join-Path $PSScriptRoot 'common.ps1')

$creator = Find-CocosCreator
if (-not $creator) {
    throw 'Cocos Creator 3.8.8 was not found. Install it from Cocos Dashboard first.'
}

if (Get-Process -Name CocosCreator -ErrorAction SilentlyContinue) {
    throw 'Cocos Creator is already running. Close the editor before building, then retry.'
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$project = Join-Path $repoRoot 'apps\game-client'
$output = Join-Path $project 'build\wechatgame\game.js'
$buildOptions = 'platform=wechatgame;buildPath=project://build;outputName=wechatgame'
$wechatAppId = 'wx4a2886db1f7b4047'

Write-Host "Building WeChat Mini Game: $project"
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

# The client layout is designed for a 16:9 landscape viewport. Cocos defaults
# new WeChat builds to portrait unless a platform profile exists locally, so
# normalize the generated manifest on every reproducible command-line build.
$gameConfigPath = Join-Path $project 'build\wechatgame\game.json'
if (Test-Path -LiteralPath $gameConfigPath) {
    $gameConfig = Get-Content -LiteralPath $gameConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $gameConfig.deviceOrientation = 'landscape'
    $gameConfigJson = $gameConfig | ConvertTo-Json -Depth 20
    [System.IO.File]::WriteAllText($gameConfigPath, $gameConfigJson, [System.Text.UTF8Encoding]::new($false))
    Write-Host 'Configured WeChat Mini Game for landscape orientation.'
}

# Local simulator development uses ws://127.0.0.1. Keep domain validation on
# for production builds by setting BGC_WECHAT_URL_CHECK=true.
$projectConfigPath = Join-Path $project 'build\wechatgame\project.config.json'
if (Test-Path -LiteralPath $projectConfigPath) {
    $projectConfig = Get-Content -LiteralPath $projectConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $projectConfig.appid = $wechatAppId
    if ($env:BGC_WECHAT_URL_CHECK -ne 'true') {
        $projectConfig.setting.urlCheck = $false
    }
    $projectConfigJson = $projectConfig | ConvertTo-Json -Depth 20 -Compress
    [System.IO.File]::WriteAllText($projectConfigPath, $projectConfigJson, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Configured WeChat Mini Game AppID: $wechatAppId"
    if ($env:BGC_WECHAT_URL_CHECK -ne 'true') {
        Write-Host 'Disabled WeChat legal-domain validation for local simulator development.'
    }
}

Write-Host "WeChat Mini Game build succeeded: $output"
