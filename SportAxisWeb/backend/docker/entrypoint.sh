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

# Emails (committee QR codes, schedule notices) are queued so saving an event
# doesn't wait on ~50 SMTP sends. The free plan has no separate worker service,
# so a worker runs in this container beside Apache. QUEUE_WORKER=false turns it
# off (the queue then follows QUEUE_CONNECTION). Set before `optimize` caches
# the config.
if [ "${QUEUE_WORKER:-true}" = "true" ]; then
    export QUEUE_CONNECTION=database
fi

php artisan storage:link --force >/dev/null 2>&1 || true
# Config, routes, events and views, all cached for production.
php artisan optimize

# The free plan has no pre-deploy step, so apply pending migrations on boot.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    php artisan migrate --force
fi

chown -R www-data:www-data storage bootstrap/cache

if [ "${QUEUE_WORKER:-true}" = "true" ]; then
    # Restarted if it exits (--max-time keeps memory in check on a long run).
    ( while true; do
        su -s /bin/sh www-data -c "php artisan queue:work --sleep=3 --tries=3 --max-time=3600" || true
        sleep 2
    done ) &
fi

exec apache2-foreground
