@echo off
setlocal enabledelayedexpansion

title Event Horizon

:: Always run from the directory containing this script
cd /d "%~dp0"

echo ===================================================
echo               Starting Event Horizon
echo ===================================================
echo.

:: Check Node.js installation
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in your system PATH.
    echo Please install Node.js 20.19+ or 22.12+ from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Check npm installation
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not found in your system PATH.
    echo Please ensure Node.js and npm are properly installed.
    echo.
    pause
    exit /b 1
)

:: Install dependencies if node_modules is missing
if not exist "node_modules\" (
    echo [INFO] node_modules not found. Installing dependencies...
    echo Running: npm install
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] "npm install" failed. Please check the logs above.
        pause
        exit /b %errorlevel%
    )
    echo.
    echo [INFO] Dependencies installed successfully.
    echo.
)

:: Launch the development server and open browser
echo [INFO] Starting Vite development server...
echo [INFO] Opening Event Horizon in your default browser...
echo.

call npm run dev -- --open %*
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Event Horizon stopped with an error. Exit code: %errorlevel%
    pause
    exit /b %errorlevel%
)

endlocal

