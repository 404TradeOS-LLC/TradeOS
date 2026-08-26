#!/usr/bin/env bash
set -euo pipefail

# Production-safe migration rollout: applies tracked Prisma migrations
# through an elevated connection, then (re)provisions the restricted
# application role so it can see anything the migrations just created. This
# is the one command CI/CD (or a manual release step) should run — it's the
# same path scripts/test-integration-db.sh exercises on every test run, so
# there's no drift between "how we test" and "how we deploy".
#
# Required:
#   DATABASE_ADMIN_URL   Elevated connection string. Migrations include
#                         forced-RLS/policy DDL the restricted app role is
#                         never granted permission to run.
# Optional:
#   APP_DB_ROLE_PASSWORD  If set, also (re)provisions the application role
#                         via provision-app-role.sh. If unset, the role step
#                         is skipped with a warning — useful if role
#                         provisioning is handled by a separate process.

: "${DATABASE_ADMIN_URL:?DATABASE_ADMIN_URL is required (elevated connection — migrations include forced RLS/policy DDL the restricted app role cannot run)}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

DATABASE_URL="$DATABASE_ADMIN_URL" npx prisma migrate deploy

if [ -n "${APP_DB_ROLE_PASSWORD:-}" ]; then
  bash "$SCRIPT_DIR/provision-app-role.sh"
else
  echo "APP_DB_ROLE_PASSWORD not set — skipping application role provisioning step." >&2
fi
