#!/bin/sh
set -e

# Render routes traffic to $PORT (10000 by default).
PORT="${PORT:-10000}"
sed -i "s/^Listen .*/Listen ${PORT}/" /etc/apache2/ports.conf
sed -i "s/<VirtualHost \*:[0-9]*>/<VirtualHost *:${PORT}>/" /etc/apache2/sites-available/000-default.conf

# Managed MySQL wants TLS. TiDB Cloud's certificate is signed by a public CA,
# so the system bundle verifies it (the default below). A provider with its
# own CA (e.g. Aiven): paste the CA file's contents into DB_SSL_CA_PEM.
if [ -n "$DB_SSL_CA_PEM" ]; then
    printf '%s\n' "$DB_SSL_CA_PEM" > /var/www/html/storage/db-ca.pem
    export MYSQL_ATTR_SSL_CA=/var/www/html/storage/db-ca.pem
elif [ -z "$MYSQL_ATTR_SSL_CA" ] && [ -f /etc/ssl/certs/ca-certificates.crt ]; then
    export MYSQL_ATTR_SSL_CA=/etc/ssl/certs/ca-certificates.crt
fi

php artisan storage:link --force >/dev/null 2>&1 || true
php artisan config:cache
php artisan route:cache

# The free plan has no pre-deploy step, so apply pending migrations on boot.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    php artisan migrate --force
fi

chown -R www-data:www-data storage bootstrap/cache
exec apache2-foreground
