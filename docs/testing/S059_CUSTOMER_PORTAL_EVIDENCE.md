# S059 customer portal security evidence

Status: pending authenticated browser and real PostgreSQL/RLS run. This file is
the capture contract, not certification that the journey has passed.

Use an isolated non-production organization with synthetic customers A and B,
and a separate organization C. Run at the exact deployed branch SHA with an
authorized staff identity. Keep secrets only in process memory, never in
fixture files, command arguments, retained environment dumps, test snapshots,
trace/video/HAR/network exports, screenshots, console output, or CI logs.

1. Issue through authorized staff, then open the link without capturing its
   address or request details. Confirm the access GET does not consume the
   token, then begin capture only after the clean `/access/confirm` URL loads.
   The browser capture must omit URL-bearing history and pending-cookie values.
2. Submit confirmation using the site's exact origin. Verify the clean portal
   URL, and inspect the HttpOnly session cookie's flags in memory without
   retaining or logging its value. The required HttpOnly cookie is not a scan
   failure. Verify customer A's permitted project, proposal, invoice, contract
   and PDFs. Capture rendered pages only after confirming the URL has no token.
3. For each denied attempt record case label, HTTP status, and redacted
   outcome only: replay; revoke before redemption; revoke after redemption;
   expired access; expired session; malformed access/session; wrong origin;
   customer B project/proposal/invoice/contract/PDF; organization C equivalents;
   portal session on staff API; draft proposal/invoice detail and PDF. For
   signing, verify only customer A's exact pending contract and attribution.
4. Scan browser-readable storage and retained artifacts, including persisted
   screenshots, recordings, traces, CI artifacts, app/edge logs, analytics and
   referrers, for access-token or session values. The HttpOnly session cookie
   is not browser-readable and must not be read or retained for this scan; its
   flags are checked in memory as described above. Use an in-memory comparison
   and retain only the Boolean scan result and artifact manifest. Never print
   a searched secret when reporting failure.
5. Record tested deployment SHA, sanitized tenant fixture IDs, role, viewport,
   check statuses, and cleanup evidence. Release readiness requires the real
   PostgreSQL integration/RLS run and exact-head required CI alongside browser
   checks. Do not mark the connection matrix `CURRENT_HEAD_CERTIFIED` until
   all evidence is collected.

The staff link display and Copy action are an authorized bearer handoff.
Exclude that staff view from retained captures while the link is visible.
