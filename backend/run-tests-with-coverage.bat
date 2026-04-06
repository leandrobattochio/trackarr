@echo off
setlocal

cd /d "%~dp0"
set "DOTNET_CLI_HOME=%cd%\.dotnet"

dotnet restore TrackerStats.sln
if errorlevel 1 goto :fail

if not exist ".tools\reportgenerator.exe" (
  dotnet tool install --tool-path .tools dotnet-reportgenerator-globaltool
  if errorlevel 1 goto :fail
)

dotnet test TrackerStats.sln ^
  --configuration Release ^
  --no-restore ^
  --collect:"XPlat Code Coverage" ^
  --settings coverage.runsettings ^
  --results-directory TestResults ^
  --logger "trx;LogFileName=tests.trx"
if errorlevel 1 goto :fail

.tools\reportgenerator ^
  -reports:"TestResults\**\coverage.cobertura.xml" ^
  -targetdir:"CoverageReport" ^
  -filefilters:"-**\obj\**\*.cs;-**\Data\AppDbContext.cs" ^
  -reporttypes:"Html;Cobertura"
if errorlevel 1 goto :fail

echo Coverage report generated in backend\CoverageReport
exit /b 0

:fail
exit /b %errorlevel%
