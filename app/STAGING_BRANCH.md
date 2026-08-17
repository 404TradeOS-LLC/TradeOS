# `staging` branch

This branch exists only to give the `tradeos-costbook` Vercel project a
stable Preview branch-alias URL (`tradeos-costbook-git-staging-*.vercel.app`)
for use as a shared staging backend by frontend Preview deployments.

It intentionally carries no application changes beyond this marker file,
which exists solely so Vercel's `ignoreCommand` (in `app/vercel.json`) sees
a real diff against the last successful deployment and does not skip the
build. Do not develop features on this branch — branch from `main` instead.
