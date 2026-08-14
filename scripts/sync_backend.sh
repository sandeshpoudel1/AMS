#!/bin/sh
# Sync Laravel app files from Backend/.devcontainer/app into backend/
set -e

SRC_DIR="Backend/.devcontainer/app"
DST_DIR="backend"

if [ ! -d "$SRC_DIR" ]; then
  echo "Source directory $SRC_DIR does not exist"
  exit 1
fi

mkdir -p "$DST_DIR"

# Copy selected top-level files and directories
rsync -av --exclude='vendor' --exclude='node_modules' \
  "$SRC_DIR/" "$DST_DIR/" \
  --include='artisan' --include='composer.json' --include='composer.lock' \
  --include='app/***' --include='bootstrap/***' --include='config/***' \
  --include='database/***' --include='public/***' --include='resources/***' \
  --include='routes/***' --include='storage/***' --include='tests/***' \
  --exclude='*'

echo "Synced $SRC_DIR -> $DST_DIR"
