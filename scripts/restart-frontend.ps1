Param(
    [switch]$Production
)

$ErrorActionPreference = 'Stop'

Write-Host "→ Подготовка фронтенда" -ForegroundColor Cyan
Push-Location frontend

try {
    if (Test-Path package-lock.json) {
        Write-Host "   npm install --frozen-lockfile" -ForegroundColor DarkCyan
        npm install | Out-Null
    } else {
        Write-Host "   package-lock.json не найден, пропускаю npm install" -ForegroundColor Yellow
    }

    if ($Production) {
        Write-Host "   npm run build" -ForegroundColor DarkCyan
        npm run build | Out-Null
    }
} finally {
    Pop-Location
}

if ($Production) {
    Write-Host "→ Перезапуск контейнера frontend (prod)" -ForegroundColor Cyan
    $env:FRONTEND_TARGET = 'prod'
} else {
    Write-Host "→ Перезапуск контейнера frontend (dev)" -ForegroundColor Cyan
    $env:FRONTEND_TARGET = 'dev'
}

try {
    docker compose -f infra/docker-compose.yml up -d --build frontend | Out-Null
} finally {
    Remove-Item Env:FRONTEND_TARGET -ErrorAction SilentlyContinue
}

Write-Host "✓ Готово. Фронтенд доступен по адресу http://localhost:3000/" -ForegroundColor Green
