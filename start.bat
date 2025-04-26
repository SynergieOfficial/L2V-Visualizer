@echo off
title Visualizer Launcher

echo.
echo Starting server in a new window...
start "Visualizer Server" cmd /k "node server.js"

echo.
echo Opening browser to http://localhost:3000 ...
start http://localhost:3000

goto end

:end
echo.
echo Setup complete. Press any key to close...
pause >nul