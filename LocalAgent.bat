@echo off
chcp 65001 >nul
cd /d "%~dp0"
title LocalAgent 0.1_beta
echo LocalAgent 0.1_beta
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Нужен Node.js 20+ — скачай с https://nodejs.org и перезапусти этот файл.
  start https://nodejs.org/en/download
  pause
  exit /b 1
)
node electron\launch.cjs
if errorlevel 1 pause
