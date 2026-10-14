@echo off
title Task Management System
echo ========================================================
echo  Task Management System - Spring Boot + Next.js
echo ========================================================
echo.
echo [1/3] Launching Spring Boot Backend on http://localhost:8080 ...
start "Spring Boot Backend (Port 8080)" "%~dp0start-backend.bat"

echo.
echo [2/3] Waiting for backend initialization...
timeout /t 5 /nobreak >nul

echo.
echo [3/3] Launching Next.js Frontend on http://localhost:3000 ...
start "Next.js Frontend (Port 3000)" "%~dp0start-frontend.bat"

echo.
echo ========================================================
echo Both servers are starting up!
echo - Frontend UI:  http://localhost:3000
echo - Spring Boot:  http://localhost:8080
echo ========================================================
timeout /t 4 /nobreak >nul
start http://localhost:3000/login
