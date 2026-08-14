#!/bin/sh
set -e

# Default port
: ${PORT:=80}

# Render the nginx template
if [ -f /etc/nginx/nginx.conf.template ]; then
  envsubst '${PORT}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf
fi

# Ensure storage and cache directories are writable
chown -R www-data:www-data /srv/app/storage /srv/app/bootstrap/cache || true

# Start php-fpm in background
echo "Starting php-fpm..."
php-fpm &

# Start nginx in foreground
echo "Starting nginx on port ${PORT}..."
nginx -g 'daemon off;'
