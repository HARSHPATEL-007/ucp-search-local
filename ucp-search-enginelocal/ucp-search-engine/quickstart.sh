#!/bin/bash
set -e

echo "═══════════════════════════════════════════════════════════"
echo "  UCP Search Engine - Local Development Setup"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker Desktop:"
    echo "   https://www.docker.com/products/docker-desktop"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose not found. Please install it."
    exit 1
fi

echo "✅ Docker found"

# Step 1: Start infrastructure
echo ""
echo "Step 1: Starting Elasticsearch + PostgreSQL + Redis..."
docker compose up -d elasticsearch postgres redis

echo "⏳ Waiting for services to be healthy..."
sleep 15

# Step 2: Install server dependencies
echo ""
echo "Step 2: Installing server dependencies..."
cd server
npm install
cd ..

# Step 3: Start API server
echo ""
echo "Step 3: Starting API server..."
docker compose up -d api

# Step 4: Seed demo data
echo ""
echo "Step 4: Seeding demo data..."
sleep 5
curl -X POST http://localhost:4000/api/search/seed || echo "⚠️  Seed failed, API may still be starting"

# Step 5: Open demo
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ Setup Complete!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  API Server:    http://localhost:4000"
echo "  Health Check:  http://localhost:4000/health"
echo "  Search API:    POST http://localhost:4000/api/search/elastic"
echo "  Elasticsearch: http://localhost:9200"
echo "  PostgreSQL:    localhost:5432"
echo "  Redis:         localhost:6379"
echo ""
echo "  Open demo.html in your browser to test the search shell."
echo ""
echo "  Commands:"
echo "    docker compose logs -f api     # Watch API logs"
echo "    docker compose down            # Stop all services"
echo "    docker compose down -v         # Stop and remove data"
echo ""
