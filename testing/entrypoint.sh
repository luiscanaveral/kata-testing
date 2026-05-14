#!/bin/sh
set -e

echo "Waiting for backend..."
until wget -q -O /dev/null http://backend:8000/health 2>/dev/null; do
  sleep 2
done

echo "Waiting for frontend..."
until wget -q -O /dev/null http://frontend:3000 2>/dev/null; do
  sleep 2
done

echo "Both services are ready. Running tests..."
npx playwright install chromium
exec npx playwright test "$@"
