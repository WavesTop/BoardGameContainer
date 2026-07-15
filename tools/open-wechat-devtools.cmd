@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0open-wechat-devtools.ps1"
exit /b %ERRORLEVEL%
