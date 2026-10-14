@echo off
title Allow Network Access for Task Management System
echo ========================================================
echo  Task Management System - Enable Network Access
echo ========================================================
echo.
echo Requesting administrator privileges...
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo.
    echo [!] ERROR: This script must be run as Administrator!
    echo.
    echo Please RIGHT-CLICK this file and select:
    echo   "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo Adding Windows Firewall rule for Port 3000 (Next.js Frontend)...
netsh advfirewall firewall delete rule name="Task Management Frontend (Port 3000)" >nul 2>&1
netsh advfirewall firewall add rule name="Task Management Frontend (Port 3000)" dir=in action=allow protocol=TCP localport=3000 profile=any

echo Adding Windows Firewall rule for Port 8080 (Spring Boot Backend)...
netsh advfirewall firewall delete rule name="Task Management Backend (Port 8080)" >nul 2>&1
netsh advfirewall firewall add rule name="Task Management Backend (Port 8080)" dir=in action=allow protocol=TCP localport=8080 profile=any

echo.
echo ========================================================
echo [SUCCESS] Windows Firewall rules added successfully!
echo Other devices on your Wi-Fi/LAN can now access:
echo.
echo   http://192.168.108.151:3000
echo ========================================================
pause
