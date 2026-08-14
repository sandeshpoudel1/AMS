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
COPY . ./
RUN composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader --no-progress

FROM php:8.4-fpm-alpine AS runtime
RUN apk add --no-cache \
    nginx \
    gettext \
    postgresql-libs \
    curl \
    libpng \
    libxml2 \
    zlib \
    libzip \
    oniguruma \
    zip \
    unzip \
    openssl \
    ca-certificates
COPY --from=builder /usr/local/lib/php/extensions/ /usr/local/lib/php/extensions/
COPY --from=builder /usr/local/etc/php/conf.d/ /usr/local/etc/php/conf.d/
WORKDIR /srv/app
COPY --from=builder /srv/app /srv/app
COPY nginx.conf.template /etc/nginx/nginx.conf.template
COPY start.sh /start.sh
RUN chmod +x /start.sh
EXPOSE 80
ENV PORT=80
CMD ["/start.sh"]