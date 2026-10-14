@echo off
title Spring Boot Backend (Port 8080)
cd /d "%~dp0spring-boot-backend"
echo ==========================================
echo Starting Spring Boot Backend (Port 8080)...
echo ==========================================
call .\mvnw.cmd spring-boot:run
pause
