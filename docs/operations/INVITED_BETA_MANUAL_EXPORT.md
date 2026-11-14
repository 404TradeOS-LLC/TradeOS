# Selected invited-beta journey export rehearsal

This is a bounded, read-only **synthetic staging rehearsal**, not the planned S092
tenant lifecycle/export feature. It demonstrates a manual support path for one
explicitly selected Customer → Project → Estimate version → Proposal/PDF journey
through existing authenticated APIs. It does not authorize exports of real
business data or establish full-tenant/GDPR export completeness.

## Scope and safeguards

`scripts/invited-beta-journey-export.mjs` requires the canonical staging API,
expected deployed commit, pinned organization and operator UUIDs, four explicit
record UUIDs and the selected Estimate version. It verifies actual Settings
owner/admin membership, the complete record relationship chain, and staging
health/readiness before and after collection. Every HTTP operation is GET;
redirects and record-provided URLs are never followed.

The five output files contain Customer details, selected Project details,
Estimate API representation including line items, saved Proposal API fields,
and the authenticated Proposal PDF. The manifest records selection, source
identity, file lengths and SHA-256 hashes. Related Jobs/invoices, delivery
histories, audit events, account/authentication data, other projects/versions and
Storage objects are excluded. Reads are not a transactional database snapshot.

Output must be a new directory outside a Git repository. The helper uses private
temporary files (directory0700/files0600) and publishes only after all reads and
identity checks succeed. Existing output is never overwritten. HTTP failures,
foreign records, mismatched versions/relationships or runtime drift abort the
export. Failure output contains fixed codes, not API bodies, bearer tokens or
record data.

## Synthetic rehearsal procedure

1. Select records created by the approved synthetic acceptance fixture. Record
   the exact Customer, Project, Estimate, Estimate version and Proposal IDs;
   confirm that the Proposal references that Estimate. Use a quiet fixture so
   concurrent edits do not change its API representations during collection.
2. Create an ID-only selection JSON outside the repository with these keys:
   `baseUrl`, `expectedSha`, `orgId`, `userId`, `customerId`, `projectId`,
   `estimateId`, `estimateVersion`, `proposalId`, `syntheticOnly:true`.
   `baseUrl` must be
   `https://tradeos-costbook-git-staging-billykshowalters.vercel.app`.
3. Supply an authenticated synthetic owner/admin access token **in memory** as
   `BETA_EXPORT_TOKEN`. Do not pass it as a CLI argument, paste it into the
   selection JSON, print it, or retain browser storage state. Set
   `BETA_EXPORT_SELECTION` to the selection file and `BETA_EXPORT_OUTPUT` to a
   new absolute directory under an existing private parent outside Git.
4. Run `node scripts/invited-beta-journey-export.mjs`. A successful summary has
   `status:passed` and `fileCount:5`. Inspect the private manifest, verify all
   SHA-256 hashes and visually inspect the PDF against the selected saved data.
5. Prove a known foreign Customer exists by reading it as its own isolated
   synthetic owner, then repeat the helper with that foreign Customer ID and
   the original operator. It must fail and publish no output directory. Never
   substitute a fabricated404-only ID for this negative control.
6. Retain only approved synthetic export artifacts and a sanitized receipt in
   the private release evidence destination. Never upload authentication state,
   credentials or customer data into GitHub/CI logs. Treat real-business exports
   as confidential deliverables requiring a separately approved data-handling
   procedure, recipient identity and retention policy; this helper intentionally
   rejects production and non-synthetic configuration.

## Evidence and remaining limits

On 2026-11-14, an actual synthetic staging rehearsal against
`9cd3813b5a1153a40060d3e2e399bf399cf9ad7b` exported all five files with matching
hashes. A foreign Customer was readable as its actual owner (HTTP 200), while
the exporting owner was denied and no partial export directory was published.
The [sanitized receipt](INVITED_BETA_EXPORT_RECEIPT_2026-11-14.json) records the
exact helper file hash, source baseline and uncommitted-at-capture status. Unit checks also cover role/user/org/record/version mismatch, hostile
PDF URLs/redirects, HTML PDF errors, private permissions and output guards.

This result does **not** close general tenant export, Storage export, account
suspension, session revocation, deletion/retention, provider recovery or the
overall invited-beta release gate. It creates no import or restore capability,
sends no messages, and changes no application endpoints, permissions, RLS
policies, schema or numbered sprint status.
