# TradeOS Web

Next.js App Router frontend for the TradeOS backend in `../app`.

For current implementation truth and architecture, start with:

- [../docs/CURRENT_STATE.md](../docs/CURRENT_STATE.md)
- [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
- [../docs/API_REFERENCE.md](../docs/API_REFERENCE.md)
- [../docs/modules/](../docs/modules/)

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Requires the backend API running and reachable at `BACKEND_API_URL` (defaults to `http://localhost:4000`).

For auth and Storage-backed uploads, also set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` when uploads are used
- `SUPABASE_STORAGE_BUCKET_PUBLIC=false` when server-rendered pages must use signed URLs from `storagePath`

## Current Route Surface

Public routes:

- `/`
- `/login`
- `/signup`

Authenticated app routes include:

- `/dashboard`
- `/customers`
- `/customers/new`
- `/customers/[id]`
- `/projects`
- `/projects/new`
- `/projects/[id]`
- `/projects/[id]/intake`
- `/projects/[id]/estimates/[estimateId]`
- `/projects/[id]/estimates/[estimateId]/assist`
- `/projects/[id]/estimates/compare`
- `/projects/[id]/proposals/new`
- `/projects/[id]/proposals/[proposalId]`
- `/projects/[id]/proposals/[proposalId]/preview`
- `/projects/[id]/invoices/new`
- `/projects/[id]/invoices/[invoiceId]`
- `/projects/[id]/contracts/[contractId]`
- `/portal/projects/[id]`
- `/portal/proposals/[proposalId]`
- `/portal/contracts/[contractId]`
- `/portal/invoices/[invoiceId]`
- `/brand-studio`
- `/settings`

Routes are grouped under the app shell where appropriate. Verify current files under `src/app/` before adding or renaming route documentation.

## Auth Model

- `src/app/actions/auth.ts` calls backend signup/login actions and stores the returned JWT in an httpOnly cookie.
- The token must not be exposed to browser JavaScript.
- Protected page access is enforced by the app shell and `web/proxy.ts` matcher coverage.

Seeded backend users are not automatically proof that hosted Supabase web-login credentials are usable. Verify login against the target environment before promising founder preview readiness.

## Backend Access Patterns

Use the existing access patterns:

- Server Components and Server Actions call `src/lib/api.ts` with the session token read server-side.
- Interactive Client Components call `src/lib/clientApi.ts`, which forwards through `src/app/api/proxy/[...path]/route.ts`.
- Binary proposal, invoice, and contract downloads use `src/app/api/documents/[...path]/route.ts` so PDF bytes are not corrupted by JSON/text proxy handling.

Prefer Server Components unless interactivity, browser APIs, forms that require client state, or existing client-only patterns require a Client Component.

## Data And State

- Server state is fetched in Server Components by default.
- TanStack Query is used where a page is genuinely interactive, such as estimate editing and AI assist review flows.
- AI Estimate Assist currently renders a reviewable suggestion workflow through the existing proxy-backed client pattern. Backend structured estimator draft/apply endpoints exist, but that newer contract is not fully the web surface yet.

## Verification

```bash
npm run lint
npm run build
```

Repository CI runs these commands through [../.github/workflows/verify-repository.yml](../.github/workflows/verify-repository.yml).
