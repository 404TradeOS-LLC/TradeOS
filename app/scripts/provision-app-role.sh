#!/usr/bin/env bash
set -euo pipefail

# Idempotently provisions the restricted application database role and its
# grants. Safe to re-run on every deploy: creates the role if missing,
# updates its password/attributes if it already exists, and re-grants
# access to every current object plus default privileges for future ones.
#
# Required:
#   DATABASE_ADMIN_URL   Elevated connection string (must be able to create
#                         roles and grant privileges — the role being
#                         provisioned cannot do this for itself).
#   APP_DB_ROLE_PASSWORD  Password for the role. Never commit this; pass it
#                         in from your secret manager / CI variable store.
# Optional:
#   APP_DB_ROLE_NAME      Defaults to "tradeos_app".

: "${DATABASE_ADMIN_URL:?DATABASE_ADMIN_URL is required (elevated connection — this role cannot grant privileges to itself)}"
: "${APP_DB_ROLE_PASSWORD:?APP_DB_ROLE_PASSWORD is required}"
APP_DB_ROLE_NAME="${APP_DB_ROLE_NAME:-tradeos_app}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Prisma connection strings often carry a "?schema=public" query param that
# psql doesn't understand (newer psql versions reject unknown params
# outright rather than ignoring them). It's not needed here — every
# statement below is already schema-qualified — so strip any query string.
PSQL_ADMIN_URL="${DATABASE_ADMIN_URL%%\?*}"

psql "$PSQL_ADMIN_URL" -v ON_ERROR_STOP=1 \
  -v role_name="$APP_DB_ROLE_NAME" \
  -v role_password="$APP_DB_ROLE_PASSWORD" \
  -f "$SCRIPT_DIR/sql/provision-app-role.sql"

echo "Provisioned role '$APP_DB_ROLE_NAME' and its grants."
