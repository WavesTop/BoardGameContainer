. (Join-Path $PSScriptRoot 'common.ps1')
$cli = Find-WeChatDevToolsCli
if (-not $cli) { throw 'WeChat DevTools CLI not found. Install the official WeChat Developer Tools first.' }
$project = Join-Path (Split-Path -Parent $PSScriptRoot) 'apps\game-client\build\wechatgame'
if (-not (Test-Path -LiteralPath $project)) { throw 'WeChat Mini Game build not found. Build it from Cocos Creator first.' }
$process = Start-Process -FilePath $cli -ArgumentList @('open', '--project', $project) -PassThru -WindowStyle Hidden
Write-Host "Opening WeChat DevTools (launcher PID $($process.Id)): $project"
