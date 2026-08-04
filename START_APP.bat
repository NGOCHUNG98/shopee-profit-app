@echo off
title Shopee Profit Web App Launcher
echo ====================================================
echo   DANG KHOI DONG SHOPEE PROFIT WEB APP...
echo   VUI LONG KHONG DONG CUA SO NAY KHI DANG DUNG APP
echo ====================================================
cd /d "%~dp0"
start http://localhost:3000
"C:\Program Files\nodejs\node.exe" server.js
pause
