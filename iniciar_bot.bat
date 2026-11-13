@echo off
title Tekó Biotech - Telegram Bot
echo ==================================================
echo   Iniciando Tekó Biotech - Bot do Telegram
echo   Hackathon das Engenharias UERGS 2026
echo ==================================================
echo Lembre-se de configurar seu token em bot\.env!
echo.
cd /d %~dp0\bot
python phytosense_bot.py
pause
