@echo off
title Fit Check - log in to Expo
set "PATH=%USERPROFILE%\tools\node-v24.19.0-win-x64;%PATH%"
cd /d "%~dp0mobile"
echo.
echo  Log in with your Expo account.
echo  No account yet? Create one free at https://expo.dev/signup first.
echo.
call npx --yes eas-cli@latest login
echo.
call npx eas-cli@latest whoami
echo.
echo  If you see your username above, you're logged in. Close this window and tell Claude.
pause
