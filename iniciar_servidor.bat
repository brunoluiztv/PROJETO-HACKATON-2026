@echo off
title Tekó Biotech - Backend FastAPI
echo ==================================================
echo   Iniciando Tekó Biotech - Backend FastAPI
echo   Hackathon das Engenharias UERGS 2026
echo ==================================================
echo API disponivel em: http://localhost:8000
echo Swagger Docs em:   http://localhost:8000/docs
echo.
cd /d %~dp0
python -m uvicorn backend.server:app --reload --port 8000 --host 0.0.0.0
pause
