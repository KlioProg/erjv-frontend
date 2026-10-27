@echo off
setlocal EnableExtensions DisableDelayedExpansion
set "SETUP_EXIT=1"
pushd "%~dp0"
if errorlevel 1 goto finish

echo Setting up ERJV frontend for local development...
where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Install Node.js 22 or newer with npm, then reopen this script.
  goto failed
)
node -e "process.exit(Number(process.versions.node.split('.')[0])>=22 ? 0 : 1)"
if errorlevel 1 (
  echo ERROR: This frontend requires Node.js 22 or newer.
  goto failed
)
where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm is missing from PATH. Reinstall Node.js with npm included.
  goto failed
)
if not exist ".env" (
  copy /y ".env.example" ".env" >nul
  if errorlevel 1 goto failed
  echo Created .env from .env.example.
) else (
  echo Keeping existing .env.
)

echo Installing locked dependencies...
call npm.cmd ci --include=dev
if errorlevel 1 goto failed
echo Checking TypeScript...
call node_modules\.bin\tsc.cmd -b
if errorlevel 1 goto failed

echo.
echo Frontend setup complete. Start Vite from this folder with: npm run dev
echo Default frontend: http://localhost:5173
echo Start the backend at http://localhost:3000 for API requests through the Vite proxy.
echo Before a production build, replace VITE_API_BASE_URL in .env with your backend HTTPS origin.
set "SETUP_EXIT=0"
goto cleanup

:failed
echo.
echo ERROR: Frontend setup stopped. Resolve the error above, then run this script again.
:cleanup
popd
:finish
if /i not "%~1"=="--no-pause" pause
exit /b %SETUP_EXIT%
