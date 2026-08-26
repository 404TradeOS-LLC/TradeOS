#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="${TRADEOS_TEST_DB_CONTAINER:-tradeos-costbook-test}"
PORT="${TRADEOS_TEST_DB_PORT:-55432}"
PASSWORD="tradeos_test"
APP_PASSWORD="tradeos_app_test"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker run \
  --name "$CONTAINER_NAME" \
  -e POSTGRES_PASSWORD="$PASSWORD" \
  -e POSTGRES_DB=tradeos_test \
  -p "127.0.0.1:${PORT}:5432" \
  -d postgres:16-alpine >/dev/null

for _ in $(seq 1 30); do
  if docker exec "$CONTAINER_NAME" pg_isready -U postgres -d tradeos_test >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

export TEST_DATABASE_ADMIN_URL="postgresql://postgres:${PASSWORD}@127.0.0.1:${PORT}/tradeos_test?schema=public"
export TEST_DATABASE_URL="postgresql://tradeos_app:${APP_PASSWORD}@127.0.0.1:${PORT}/tradeos_test?schema=public"

# Same path production deploys use (scripts/deploy-migrations.sh): tracked
# Prisma migrations + idempotent app-role provisioning. Running it here too
# means every test:integration run is also a live rehearsal of the real
# rollout automation, not a separate hand-rolled path that could drift from it.
DATABASE_ADMIN_URL="$TEST_DATABASE_ADMIN_URL" APP_DB_ROLE_PASSWORD="$APP_PASSWORD" bash "$SCRIPT_DIR/deploy-migrations.sh"

export DATABASE_URL="$TEST_DATABASE_URL"
npx jest --config jest.integration.config.js --runInBand
