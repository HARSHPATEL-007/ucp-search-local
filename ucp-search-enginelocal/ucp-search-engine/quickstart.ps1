Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  UCP Search Engine - Local Development Setup" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check Docker
$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
    Write-Host "❌ Docker not found. Install Docker Desktop:" -ForegroundColor Red
    Write-Host "   https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Docker found" -ForegroundColor Green

# Step 1
Write-Host ""
Write-Host "Step 1: Starting infrastructure..." -ForegroundColor Cyan
docker compose up -d elasticsearch postgres redis

Write-Host "⏳ Waiting 15 seconds for services..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Step 2
Write-Host ""
Write-Host "Step 2: Installing server dependencies..." -ForegroundColor Cyan
Set-Location server
npm install
Set-Location ..

# Step 3
Write-Host ""
Write-Host "Step 3: Starting API server..." -ForegroundColor Cyan
docker compose up -d api

# Step 4
Write-Host ""
Write-Host "Step 4: Seeding demo data..." -ForegroundColor Cyan
Start-Sleep -Seconds 5
try {
    Invoke-RestMethod -Uri "http://localhost:4000/api/search/seed" -Method POST
    Write-Host "✅ Demo data seeded" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Seed failed, API may still be starting" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✅ Setup Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  API Server:    http://localhost:4000"
Write-Host "  Health Check:  http://localhost:4000/health"
Write-Host "  Search API:    POST http://localhost:4000/api/search/elastic"
Write-Host "  Elasticsearch: http://localhost:9200"
Write-Host ""
Write-Host "  Open demo.html in your browser to test the search shell."
Write-Host ""
Write-Host "  Commands:" -ForegroundColor Cyan
Write-Host "    docker compose logs -f api"
Write-Host "    docker compose down"
Write-Host "    docker compose down -v"
Write-Host ""
