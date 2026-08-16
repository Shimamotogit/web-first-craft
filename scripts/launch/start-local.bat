@echo off
chcp 65001 > nul
set "ROOT=%~dp0..\.."
pushd "%ROOT%"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 server\app.py
) else (
  python server\app.py
)
popd
pause
