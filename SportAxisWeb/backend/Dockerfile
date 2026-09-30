# Laravel API image for Render (or any Docker host). Build context is this
# backend folder. See RENDER_DEPLOYMENT.md at the repo root.
FROM php:8.3-apache

RUN apt-get update \
 && apt-get install -y --no-install-recommends libzip-dev libicu-dev unzip git ca-certificates \
 && docker-php-ext-install pdo_mysql bcmath intl zip pcntl opcache \
 && a2enmod rewrite headers \
 && rm -rf /var/lib/apt/lists/*

# Production PHP. The code in the image never changes while it runs, so
# OPcache needn't re-check files on every request.
RUN cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
 && { \
      echo 'opcache.enable=1'; \
      echo 'opcache.memory_consumption=128'; \
      echo 'opcache.interned_strings_buffer=16'; \
      echo 'opcache.max_accelerated_files=20000'; \
      echo 'opcache.validate_timestamps=0'; \
      echo 'realpath_cache_size=4096K'; \
      echo 'realpath_cache_ttl=600'; \
    } > "$PHP_INI_DIR/conf.d/zz-production.ini"

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Serve Laravel's public/ folder, and let its .htaccess route requests.
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -ri 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf \
 && sed -ri 's!AllowOverride None!AllowOverride All!g' /etc/apache2/apache2.conf

WORKDIR /var/www/html

# Dependencies first so code-only changes reuse this layer.
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --no-interaction --prefer-dist

COPY . .
# The schema dump needs the mysql CLI to load; without it migrations replay
# file by file, which works everywhere (same as the InfinityFree deploy).
RUN rm -f database/schema/mysql-schema.sql public/storage \
 && composer dump-autoload --optimize --no-dev \
 && php artisan package:discover --ansi \
 && mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs storage/app/public \
 && chown -R www-data:www-data storage bootstrap/cache

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 10000
CMD ["entrypoint.sh"]
