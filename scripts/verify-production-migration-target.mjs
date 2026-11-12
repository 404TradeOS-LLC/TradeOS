#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

// Fail closed before any production migration connection or Prisma apply.
// These identifiers are non-secret project identity, not connection credentials.
const PRODUCTION_PROJECT_REF = 'kssaceuetdjwfqnbzhly';
const PRODUCTION_POOLER_HOST = /^aws-\d+-us-west-2\.pooler\.supabase\.com$/;

/** Returns non-secret verified identity; errors must not include the URL or credentials. */
export function verifyProductionMigrationTarget(env) {
  if (env.GITHUB_REF !== 'refs/heads/main') {
    throw new Error('Production migrations must be dispatched from main.');
  }
  const raw = env.DATABASE_ADMIN_URL;
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new Error('Production admin connection credentials are unavailable.');
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Production database connection identity could not be parsed.');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) ||
      parsed.pathname !== '/postgres' || !parsed.password || parsed.hash) {
    throw new Error('Production database connection identity is not approved.');
  }
  let username;
  try { username = decodeURIComponent(parsed.username); } catch {
    throw new Error('Production database connection identity is not approved.');
  }
  const direct = parsed.hostname === `db.${PRODUCTION_PROJECT_REF}.supabase.co` &&
    (parsed.port === '' || parsed.port === '5432') && username === 'postgres';
  const sessionPooler = PRODUCTION_POOLER_HOST.test(parsed.hostname) &&
    parsed.port === '5432' && username === `postgres.${PRODUCTION_PROJECT_REF}`;
  if (!direct && !sessionPooler) {
    throw new Error('Production database connection identity is not approved.');
  }
  return { projectRef: PRODUCTION_PROJECT_REF, connectionMode: direct ? 'direct' : 'session-pooler' };
}

// Keep all DB secrets out of stdout/stderr, even for validation failures.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const verified = verifyProductionMigrationTarget(process.env);
    console.log(`Verified ${verified.connectionMode} admin target for the canonical production project; no credentials printed.`);
  } catch (error) {
    console.error('Production database migration preflight refused: ' + (error instanceof Error ? error.message : 'unknown validation error'));
    process.exitCode = 1;
  }
}
