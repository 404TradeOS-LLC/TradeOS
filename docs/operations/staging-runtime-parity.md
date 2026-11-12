# Staging runtime parity — issue #759

## Observed baseline, 2026-11-12 UTC

Repository main: `080ac08d6dd8623b59e2b7496794c761d3034a1f`.
Both staging Vercel aliases still serve `c800425fd4a94278325193d488b15925a5406d27`:

- API deployment: `dpl_7fSZLZ249YEoTUojr3N4F6yWYb8A`.
- Web deployment: `dpl_2TwA1ufEeAAtYqXcq8THAGnS5JuM`.
- API `/health` confirms that SHA. `/ready` reports the intended nonproduction
  project `qfbgdkbamfaasmtjfyru`, database connectivity and required schema.
- Read-only staging inspection found 71 completed Prisma migrations, zero
  unfinished, with all migration names and SHA-256 checksums matching main.
  Jobs, both expense tables and Team & Time have enabled and forced RLS;
  the receipt bucket `project-files` is private. Do not replay migrations.
- Team & Time is ACTIVE v6 with gateway JWT verification enabled. Its fetched
  source lacks `declined_at` assignment checks present in the reviewed repository.
- Vercel metadata listing returns 403 for both projects. No authenticated local
  CLI is available. This PR does not change permissions or secret sensitivity.

## Staging Edge source repair, 2026-11-12 UTC

After the user's instruction to fix the identified staging blockers, the already
merged and locally tested Team & Time source above was deployed only to
`qfbgdkbamfaasmtjfyru`. Version **7** is ACTIVE with `verify_jwt=true`.
The deployed `index.ts` was fetched again and matched the submitted repository
source byte for byte. An unauthenticated bootstrap request returned HTTP 401
(`UNAUTHORIZED_NO_AUTH_HEADER`). Existing health/Edge tests passed 19/19.
The previous v6 source was retained locally for the release recovery record.
No secret, schema, other Edge Function or production project was changed.
Authenticated owner/technician/declined/foreign-tenant probes remain pending;
source parity and unauthenticated denial alone do not certify those behaviors.

## Secret-free web evidence

`GET /api/staging-runtime-identity` returns configuration evidence only on a
Vercel Preview deployment from branch `staging`; all other deployments return
404. A full commit SHA, exact staging Supabase URL and exact staging backend
origin are required. Bad/missing values return sanitized 503 with no value echo.
Every response is private/no-store and nosniff. No database or external request,
credential access, authentication bypass, or configuration mutation occurs.

The response includes the full commit, staging branch, allowlisted public
Supabase project ref and backend origin, with `scope=public_configuration_only`.
The route directly references `NEXT_PUBLIC_SUPABASE_URL` so Next's build-time
substitution matches deployed auth clients. Backend destination is read in the
server runtime. Compare this with independently retrieved Vercel deployment
metadata and API `/health` and `/ready`, not an operator-supplied expected ref.

This evidence does **not** prove service-role key provenance, JWT-secret
alignment, authenticated tenant isolation, Edge Function source/version, or
deployment readiness. Those checks remain independent. Do not use this route to
waive a mismatch in the existing protected attestation workflow.

## Reviewed release sequence

1. Review and merge the identity endpoint PR through normal required checks.
   Reconcile the resulting exact main SHA with staging, including staging-only
   security controls; source equality and applied migration parity are separate.
   Preserve #958's strict project-bound readiness/pooler checks and #959's
   declined/removed assignment filters, key parsing and bounded pagination.
2. Prepare the source promotion for that exact reviewed SHA. The current main
   and staging histories diverge; an unreviewed force push or blind fast-forward
   is not a reconciliation. Use the normal reviewed staging promotion path and
   protected Environment approval. The staging push triggers the existing
   orchestrator and both app builds; inspect that effect before approving it.
3. Correlate actual web/API immutable deployment IDs and commit SHAs after both
   builds. Require the web identity endpoint to report that commit, staging
   project and backend alias. Require the API health SHA to match and readiness
   to prove the staging project. Missing, 404 or mismatched evidence is BLOCKED.
4. Completed source/version repair on 2026-11-12: through the authorized staging
   Edge deployment, replaced only
   `team-time` in project `qfbgdkbamfaasmtjfyru` with the reviewed repository file.
   Baseline source path `supabase/functions/team-time/index.ts` at main above
   has SHA-256 `7878039e873e4e1c26f06c1ff6997c4c78a9cbf15b9c2321bfdb1e203edd5530`.
   Preserve `verify_jwt=true`; change no secrets, CORS policy or other function.
   Re-fetched source matched byte for byte, version 7, with JWT verification
   retained. Recheck source/version before subsequent acceptance.
5. Run authorized synthetic owner/technician, declined/removed/unassigned Job
   and foreign-tenant denial checks, then canonical correlated preflight and
   full acceptance at 1440/1024/768/390. Keep service-key provenance and auth
   verification explicit; a public configuration response alone cannot pass it.

## Recovery and authority

The endpoint is read-only and can be reverted independently. If an approved
deployment fails identity or permission checks, stop acceptance and use the
existing reviewed Vercel rollback process; do not alter schemas or stamp ledgers.
Before replacing Edge v6, retain its fetched source and current JWT setting in
the authorized release evidence store so an approved source rollback is possible.
No production deployment, new credential, migration, or release certification
is authorized by this runbook. Protected merge and deployment decisions remain
separate from implementation and local tests.
