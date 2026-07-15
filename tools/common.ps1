$ErrorActionPreference = 'Stop'

function Find-CocosCreator {
    $direct = @(
        'C:\CocosDashboard\resources\.editors\Creator\3.8.8\CocosCreator.exe',
        'C:\Program Files (x86)\CocosDashboard\resources\.editors\Creator\3.8.8\CocosCreator.exe',
        'C:\Program Files\CocosDashboard\resources\.editors\Creator\3.8.8\CocosCreator.exe',
        'C:\CocosCreator\CocosCreator.exe',
        'C:\Program Files\CocosCreator\CocosCreator.exe',
        (Join-Path $env:USERPROFILE '.CocosCreator\editors\Creator\3.8.8\CocosCreator.exe'),
        (Join-Path $env:LOCALAPPDATA 'CocosCreator\Creator\3.8.8\CocosCreator.exe')
    )
    foreach ($path in $direct) {
        if (Test-Path -LiteralPath $path) { return $path }
    }

    $roots = @(
        'C:\CocosDashboard',
        'C:\Program Files (x86)\CocosDashboard',
        'C:\Program Files\CocosDashboard',
        'C:\ProgramData\cocos',
        (Join-Path $env:USERPROFILE '.CocosCreator'),
        (Join-Path $env:APPDATA 'CocosDashboard'),
        (Join-Path $env:LOCALAPPDATA 'CocosDashboard')
    )
    foreach ($root in $roots) {
        if (-not (Test-Path -LiteralPath $root)) { continue }
        $found = Get-ChildItem -LiteralPath $root -Recurse -Filter CocosCreator.exe -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -match '3\.8\.8|Creator' } |
            Select-Object -First 1
        if ($found) { return $found.FullName }
    }
    return $null
}

function Find-CocosDashboard {
    $candidates = @(
        'C:\Program Files (x86)\CocosDashboard\CocosDashboard.exe',
        'C:\Program Files\CocosDashboard\CocosDashboard.exe',
        'C:\CocosDashboard\CocosDashboard.exe',
        (Join-Path $env:LOCALAPPDATA 'Programs\CocosDashboard\CocosDashboard.exe')
    )
    foreach ($path in $candidates) {
        if (Test-Path -LiteralPath $path) { return $path }
    }
    return $null
}

function Find-WeChatDevToolsCli {
    $roots = @(
        'C:\Program Files (x86)\Tencent',
        'C:\Program Files\Tencent',
        (Join-Path $env:LOCALAPPDATA 'Programs')
    )
    foreach ($root in $roots) {
        if (-not (Test-Path -LiteralPath $root)) { continue }
        $found = Get-ChildItem -LiteralPath $root -Recurse -Filter cli.bat -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -match 'web|devtool|wechat' } |
            Select-Object -First 1
        if ($found) { return $found.FullName }
    }
    return $null
}
