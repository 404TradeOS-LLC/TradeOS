# `staging` branch

This branch exists only to give the `tradeos-costbook` Vercel project a
stable Preview branch-alias URL (`tradeos-costbook-git-staging-*.vercel.app`)
for use as a shared staging backend by frontend Preview deployments.

It intentionally carries no application changes beyond this marker file,
which exists solely so Vercel's `ignoreCommand` (in `app/vercel.json`) sees
a real diff against the last successful deployment and does not skip the
build. Do not develop features on this branch — branch from `main` instead.

Note: `DATABASE_URL` for this branch's Preview environment must use the
Supavisor transaction-mode pooler (`aws-0-us-east-2.pooler.supabase.com:6543`,
username `tradeos_app.<project-ref>`, `?pgbouncer=true`), not the direct
connection host (`db.<project-ref>.supabase.co:5432`). Vercel's serverless
functions can't reach Supabase's direct-connection host — it's IPv6-only on
this project tier — which surfaces as "Can't reach database server" from
`/ready`.
