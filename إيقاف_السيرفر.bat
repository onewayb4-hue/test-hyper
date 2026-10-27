@echo off
chcp 65001 > nul
title إيقاف سيرفر هايبر زايد
color 0C
echo ===================================================
echo   جاري إيقاف سيرفر هايبر زايد ماركت...
echo ===================================================
taskkill /F /IM node.exe > nul 2>&1
echo.
echo ✅ تم إيقاف السيرفر بنجاح.
timeout /t 2 /nobreak > nul
