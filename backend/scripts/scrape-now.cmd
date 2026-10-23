@echo off
rem Scrapes every portal right now, in this window (the scheduled task runs hidden).
rem Pass options through, e.g.:  scrape-now.cmd --portal amazon --portal myntra
cd /d "%~dp0.."
".venv\Scripts\python.exe" -m app.scraping.runner %*
echo.
pause
