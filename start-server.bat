@echo off
title BMS v0.1.1a
echo ========================================
echo   BMS v0.1.1a - Запуск сервера
echo ========================================
echo.

cd /d "%~dp0apps\backend"

echo Применяем миграции БД...
call pnpm exec prisma migrate deploy
if errorlevel 1 (
    echo ОШИБКА: Не удалось применить миграции
    echo Проверьте что PostgreSQL запущен и настройки в .env верны
    pause
    exit /b 1
)

echo.
echo Сервер запускается...
echo.
echo ========================================
echo  Откройте браузер: http://localhost:3001
echo  Для других устройств используйте IP
echo  этого компьютера вместо localhost
echo ========================================
echo.

pnpm exec tsx src/index.ts
pause
