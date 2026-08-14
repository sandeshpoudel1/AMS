#!/bin/sh
set -e

# Default port
: ${PORT:=80}

# Configure php-fpm pool to listen on TCP 127.0.0.1:9000 so nginx can connect
PHP_FPM_POOL_CONF="/usr/local/etc/php-fpm.d/www.conf"
if [ -f "$PHP_FPM_POOL_CONF" ]; then
  sed -i "s@^listen\s*=.*@listen = 127.0.0.1:9000@" "$PHP_FPM_POOL_CONF" || true
  sed -i "s@^listen.owner\s*=.*@listen.owner = www-data@" "$PHP_FPM_POOL_CONF" || true
  sed -i "s@^listen.group\s*=.*@listen.group = www-data@" "$PHP_FPM_POOL_CONF" || true
  sed -i "s@^;listen.mode\s*=.*@listen.mode = 0660@" "$PHP_FPM_POOL_CONF" || true
fi

# Render only the PORT variable into nginx config (avoid replacing nginx $vars)
if [ -f /etc/nginx/nginx.conf.template ]; then
  envsubst '${PORT}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf
fi

# Ensure storage and cache directories are writable
chown -R www-data:www-data /srv/app/storage /srv/app/bootstrap/cache || true

echo "Starting php-fpm..."
# Start php-fpm as a daemon
php-fpm -D || php-fpm &

echo "Starting nginx on port ${PORT}..."
nginx -g 'daemon off;'
