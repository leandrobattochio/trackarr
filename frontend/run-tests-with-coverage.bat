@echo off
setlocal

cd /d "%~dp0"

call pnpm test:coverage
if errorlevel 1 goto :fail

echo Coverage report generated in frontend\coverage
exit /b 0

:fail
exit /b %errorlevel%
