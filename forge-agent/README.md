# TradeOS Forge Agent — Eve execution service

This is an **isolated Eve agent deployable**, distinct from the existing
`forge-worker/` read-only Gatekeeper. The agent runs on Node 24 using
`eve@1.0.0-rc.3` and the Vercel Workflow SDK's durable session engine.

## Runtime and isolation

- `agent/agent.ts`: AI Gateway model configuration.
- `agent/channels/eve.ts`: authenticated Eve sessions via Vercel OIDC/local dev.
- `agent/channels/github.ts`: verified GitHub App webhook channel, **inactive
  until configured** with the required App credentials.
- `agent/sandbox.ts`: one Vercel Sandbox per session. Repository checkout,
  file changes and commands run within the isolated microVM. Outbound network
  policy allows GitHub and npm only. Secrets remain in the application runtime.
- `agent/tools/inspect_issue.ts`: bounded public issue read.
- `agent/tools/publish_draft_pr.ts`: deterministic, default-disabled,
  **draft-only** publication of a small Markdown pilot.

## GitHub write policy

GitHub writing is disabled unless **both** are configured as project secrets:

- `FORGE_GITHUB_WRITE_TOKEN`: a *repository-scoped*, short-lived credential
  with Contents/Pull Request writes; no administration, releases, actions, or
  other repository privileges.
- `FORGE_WRITE_ENABLED=true`: an explicit owner activation flag.

The target issue must be open, have the founder-controlled `forge:ready`
label, and have no overlapping open PR. The tool checks the exact current
`main` SHA twice before creating a new branch and atomic Git commit.
It can only change up to four `docs/forge/*.md` files with a combined
48 KiB maximum; all other files (including app/web code, auth, database,
workflows, settings and migrations) are rejected. It can create a **draft PR**
and nothing that merges or promotes it. Hosted CI and release approval
remain separate gates.

Optional read-only issue access uses `FORGE_GITHUB_READ_TOKEN`.
For self-managed signed GitHub webhooks, the agent project separately requires
`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, and `GITHUB_WEBHOOK_SECRET`.
Configure these through approved Vercel project credentials, never a chat
message, untrusted workflow, test artifact, or repository commit. Vercel
Connect can replace the self-managed credential path once the team grants
connector-management permissions.

A Vercel AI Gateway identity (project OIDC or AI Gateway API key) is required
for *actual model inference*. A green build proves compilation only; it does
not prove a model run, signed webhook, sandbox execution by a model, or a live
issue-to-PR outcome.

## Verification

```bash
cd forge-agent
npm ci
npm run verify
npm run build
npm run smoke
```

Verified in Vercel Sandbox (Node 24): ten policy/API regression tests passed,
`eve build` completed, and the compiled HTTP smoke checked that `/eve/v1/health`
returns 200 while unauthenticated session, info and unsigned GitHub webhook
requests return 401. The Vercel build command now executes this smoke after
compilation. No real GitHub write or model inference occurred. No GitHub write or real model inference was
performed as part of that validation.

## Deployment

Create a separate Vercel project `tradeos-forge-agent` linked to the same
GitHub repository with Root Directory `forge-agent`, framework preset
`eve`, and deployment protection enabled. Do **not** change the existing
`tradeos-forge-worker` project's deployment or runtime permissions.

Check `GET /eve/v1/health`, then a real authenticated session, then a
signed GitHub App issue event, then an eligible docs-only draft PR. Maintain
a full audit trail and require the repository's exact-head CI/review gates
before broadening to software changes. Do not mark issue #910 finished until
this sequence actually succeeds.

Related issue: https://github.com/404TradeOS-LLC/TradeOS/issues/910
