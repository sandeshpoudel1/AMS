# Multi-stage Dockerfile (php-fpm + nginx)
FROM php:8.4-fpm-alpine AS builder

RUN apk add --no-cache \
    git \
    curl \
    libpng-dev \
    libxml2-dev \
    zlib-dev \
    libzip-dev \
    oniguruma-dev \
    zip \
    unzip \
    mariadb-dev \
    postgresql-dev \
    build-base \
    openssl \
    ca-certificates \
    && docker-php-ext-install pdo_pgsql pdo_mysql mbstring exif pcntl bcmath gd zip \
    && apk del build-base postgresql-dev

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /srv/app

# Copy only composer files first to leverage docker cache
COPY app/composer.json app/composer.lock ./
RUN composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader

# Copy application code
COPY app/ ./

# Build assets step intentionally omitted; frontend is deployed separately.

FROM php:8.4-fpm-alpine AS runtime

RUN apk add --no-cache \
    nginx \
    curl \
    libpng-dev \
    libxml2-dev \
    zlib-dev \
    libzip-dev \
    oniguruma-dev \
    zip \
    unzip \
    openssl \
    ca-certificates \
    && docker-php-ext-install pdo_pgsql pdo_mysql mbstring exif pcntl bcmath gd zip || true

COPY --from=builder /srv/app /srv/app

# nginx config template and start script
COPY docker/nginx.conf.template /etc/nginx/nginx.conf.template
COPY docker/start.sh /start.sh
RUN chmod +x /start.sh

WORKDIR /srv/app

EXPOSE 80

ENV PORT=80

CMD ["/start.sh"]

