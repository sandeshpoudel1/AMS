#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/Backend/.devcontainer"

echo "🧹 Cleaning up..."
docker compose down -v || true
rm -rf app/
mkdir -p app/

echo "📂 Creating Laravel app locally..."
if [ -f "app/artisan" ]; then
    echo "✅ app folder already contains a Laravel app."
else
    docker run --rm -v "$PWD/app":/app -w /app composer:latest create-project --prefer-dist laravel/laravel .
fi

echo "🏗️ Building Docker images..."
docker compose build --no-cache

echo "🚀 Starting containers..."
docker compose up -d

echo "⏳ Waiting for containers to start..."
sleep 10

echo "🔑 Generating application key..."
docker compose exec app php artisan key:generate

echo "🎉 Done! Open http://localhost:8000"