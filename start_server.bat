@echo off
cd /d "c:\Users\PC\Desktop\Alfajores Alito's\Projecto alitos\backend"
py -m uvicorn app.main:app --reload --port 8000
pause
