## Summary

Owners can now email a team invite to a person who does not have a TradeOS account yet, from Settings → Team & Access. The new Send invite form (Technician default, Dispatcher the only other option) calls the existing `POST /api/v1/account/invites` endpoint; the recipient accepts at `/invite/accept` and creates their sign-in there. The backend, invite token, email send, and accept flow already existed — the UI was the only missing piece.

## Scope

- Branch: `feat/send-team-invite-ui`
- Base branch: `main`
- Worktree path: `~/workspace/tradeos-send-invite`
- Linked issue: Founder request 2026-11-23 (email invite for a tech with no account yet); related #872 (production email delivery)
- Scope type: frontend / docs

## Required Startup Verification

- [x] Exact worktree path verified.
- [x] Exact branch verified.
- [x] `git fetch origin --prune` run before branch comparison.
- [x] Remote repository target verified.
- [x] Upstream state reported, or missing upstream explicitly documented.
- [x] Active worktrees reviewed for overlap.
- [x] Open PR overlap reviewed.
- [x] `docs/ENGINEERING_COMMAND_CENTER.md` read after environment verification.
- [x] `docs/CURRENT_STATE.md` read.
- [x] `docs/SESSION_HANDOFF.md` read.
- [ ] `docs/REPOSITORY_GOVERNANCE.md` read for governance or workflow changes.
- [x] Allowed paths, forbidden paths, exclusions, and stop conditions were stated before edits.

Overlap classification: **EXISTING_WORK_FOUND** — the backend invite endpoint (`POST /api/v1/account/invites`, `inviteTeamMember`, `OrganizationInvite`, `sendTeamInvite`, `/invite/accept` page + action) already exists on main; this PR adds only the missing web UI, its client helper, tests, and docs. No backend code was changed.

## Change Checklist

- [x] Changes stayed inside the stated scope.
- [x] No unrelated cleanup, refactor, dependency upgrade, merge, or rebase was included.
- [x] No secrets, local-only files, generated caches, or `.codex/` artifacts were committed.
- [x] Runtime behavior changes include relevant behavioral regression tests.
- [x] Tenant isolation, authorization, validation, and service-layer write paths were reviewed when backend behavior changed.
- [ ] RLS, migration, Prisma, or database changes include live integration coverage or a documented blocker.
- [x] UI changes preserve existing design-system patterns and do not duplicate shared components.
- [x] AI-assisted features remain review-first and do not write directly to the database outside validated service-layer tools.

Notes on the unchecked items: no RLS/migration/Prisma/database change is in this PR (backend untouched), and the governance doc was not re-read because this PR makes no governance or workflow change.

## Documentation Impact

- [x] `npm run pr:preflight -- --base origin/main` was run after the final scope was known.
- [x] `docs/DOC_OWNERSHIP.yml` requirements were checked.
- [x] Required source-of-truth docs changed meaningfully in this branch.
- [ ] `docs/SESSION_HANDOFF.md` was refreshed when the session contract requires it.
- [ ] `docs/ENGINEERING_COMMAND_CENTER.md` changed only because mission, priorities, blockers, CI requirements, or operating protocol changed.
- [ ] No documentation update required.

If no documentation update was required, explain why: N/A — `docs/CURRENT_STATE.md` was updated (the only doc `docs:check` requires for `web/src/**` changes). The invite endpoint itself is already documented in `docs/API_REFERENCE.md`, `docs/RBAC_MATRIX.md`, and `docs/modules/auth-and-tenancy.md`; this PR adds a UI caller without changing the endpoint contract, so those docs need no change.

## Verification

Preflight output / relevant lanes:

- [x] `npm run pr:test`
- [x] `npm run docs:check -- --base origin/main`
- [x] `npm run docs:test`
- [ ] `cd app && npm test`
- [ ] `cd app && npm run lint`
- [ ] `cd app && npm run build`
- [ ] `cd app && npm run test:integration`
- [x] `cd web && npm test`
- [x] `cd web && npm run lint`
- [x] `cd web && npm run build`
- [x] `git diff --check`
- [ ] Other / N/A with reason:

Exact results (all on head `d6363ab3`, base `main` `50fc1a57`):

- `npm run pr:preflight -- --base origin/main`: required docs `docs/CURRENT_STATE.md`, missing none.
- `npm run pr:test`: 499 pass, 0 fail.
- `npm run docs:check`: PASS (only `docs/CURRENT_STATE.md` required).
- `npm run docs:test`: 44 pass, 0 fail.
- `cd web && npm test`: 952 pass, 0 fail (includes 9 new `send-invite.test.ts` tests and the new settings contract test).
- `cd web && npm run lint`: pass, no errors.
- `cd web && npm run build`: pass (`next build` completed).
- `git diff --check`: clean.
- App lanes: N/A — `app/` is untouched in this PR (no backend change), so no app suite was run for ceremony.

Exact final `git status --short --branch`:

```
## feat/send-team-invite-ui...origin/main [ahead 2]
```

## Environment-Blocked Checks

- Staging acceptance of a real invite send: BLOCKED — staging is frozen at candidate `7c428acd` (pre-dates this UI) for the field-closeout run; a real invite send on staging happens only after main is promoted to staging, and promotion is gated on the field-closeout run finishing (decision 12-A).
- Production acceptance of a real invite send: BLOCKED — production email delivery is broken until issue #872 is fixed (API Production is missing `EMAIL_FROM` + `APP_BASE_URL`); a production invite email will silently fail today.
- No live-browser verification was attempted (no staging deployment contains this UI yet).

## Risk Review

- [x] Branch is current with `origin/main`, or drift is documented.
- [x] Required checks match the branch protection target in `docs/REPOSITORY_GOVERNANCE.md`.
- [ ] Automated review findings were classified; deterministic scoped findings were repaired, and protected/ambiguous decisions were not auto-applied.
- [ ] Resolved review threads correspond to verified fixes on the current head.
- [ ] Founder-only merge exception is N/A, or its ADR-009 authorization, unavailable-reviewer reason, risk/rollback record, required-check evidence, and restoration trigger are documented below; self-review is not described as independent approval.
- [ ] Auto-merge is enabled only when the PR is otherwise safe and branch protection remains the final gate.
- [x] Known limitations and deferred work are documented below.

Notes: no automated review findings exist yet on this PR (none to classify at open); no review threads exist yet; no merge is requested in this PR (merging is left to the queue lane) and no auto-merge was armed. This PR touches an auth-adjacent UI surface (it calls an existing owner-only endpoint) but changes no auth policy, no backend code, no schema, and no secrets. Rollback is a plain revert of the six files; no data is created by merging.

## Known Limitations

- A pending invite is not listed anywhere in the UI. The members endpoint (`listOrganizationMembers`) reads membership rows only and never invite rows, so the "Pending invites" count in Team & Access stays 0 and the invitee appears in the directory only after accepting. The form copy says this on the card so the owner is not misled. A pending-invites list needs a new backend read and is a follow-up, not in this PR.
- Resend/revoke of a pending invite has no UI and no endpoint.
- The backend schedules the invitation email in the background and returns 201 regardless of delivery outcome (delivery failures are logged server-side only). The form's success message means "invite created and email scheduled", and on production today the email will silently fail until #872 is fixed (see Environment-Blocked Checks).
- The form is shown only to owners. Admins see Add member but not Send invite, because the endpoint enforces owner-only (`requireRoles ["owner"]`); an admin who somehow submitted would get the backend 403 surfaced with its message.
- The helper returns only inviteId, email, role, and expiry. The server returns the raw invitation token only outside production; the helper deliberately never maps, logs, stores, or displays it, and the tests assert the returned object carries no token key.

## Follow-Up Work

- Pending-invites listing: add a backend read for the org's pending `OrganizationInvite` rows and show them in Team & Access (with resend/revoke if a matching endpoint is added). Out of scope here by design.
- Staging acceptance: after main is promoted to staging, send a real invite on staging to a test address and verify receipt + the `/invite/accept` flow end to end.
- Production acceptance: after #872 is fixed (EMAIL_FROM + APP_BASE_URL on API Production), send a real invite in production and verify delivery + rendering before treating invites as live.
- Docs drift (pre-existing, not introduced here): `docs/RBAC_MATRIX.md` and `docs/modules/auth-and-tenancy.md` describe the invite endpoint as "owner/admin-gated", but the controller enforces owner-only (`requireRoles ["owner"]`). Worth a one-line correction in a docs pass; deliberately not folded into this UI PR.
