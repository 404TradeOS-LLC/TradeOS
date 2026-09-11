# A14 — Voice / Mobile Readiness Implementation Plan

Status: implementation
Owner: Athena platform
Roadmap source: `docs/athena/roadmap.md`

## Objective

Make the existing Athena platform safe and useful for field users on mobile and voice surfaces without creating a second assistant, bypassing A4/A6 authorization, or adding a new business workflow engine.

The canonical roadmap defines A14 as:

- scope: multimodal UX and mobile context;
- deliverables: voice-safe confirmations and mobile context providers;
- exit: field users can use approved low-risk flows;
- tests: mobile E2E and latency tests;
- rollback: disable the voice channel independently.

## Existing foundations reused

A14 reuses rather than replaces:

- A3 context registry/assembler and C001/C010 provider contracts;
- A4 authorization;
- A6 approval/action execution and canonical input hashing;
- A10 redacted telemetry;
- A11 security hardening;
- A12 field tools, especially `field.job-context` and `field.update-job-status`;
- A13 plugin boundaries unchanged.

The field job-context tool is already read-only, low risk, actor scoped through `JobsService`, and intentionally minimizes customer data. The status tool is also low risk but carries `confirmationPolicy: contextual`, making it a useful A14 voice-confirmation case while preserving service-owned authorization.

## Implementation slices

### 1. Channel contract

Add an additive interaction contract to `AthenaKernelRequest`:

- `channel`: `text | mobile | voice`;
- optional compact mobile metadata: platform, viewport class, connectivity state;
- optional exact voice confirmation proof containing tool id/version/input hash.

No raw audio is stored in C001, telemetry, or memory. Voice speech-to-text remains a channel adapter concern; Athena receives normalized text plus safe channel metadata.

### 2. Independent voice kill switch

`ATHENA_VOICE_ENABLED=true` is required for voice requests. Text/mobile remain independent. A disabled voice request fails closed before model/tool execution.

### 3. Voice-safe action confirmation

A14 does not replace A6 approval.

For voice tool calls:

- medium/high risk is refused by the voice channel and must move to an existing visual approval surface;
- low-risk `confirmationPolicy: never` tools may proceed normally;
- low-risk `contextual`/`always` tools require an exact confirmation bound to tool id, version, and A6's canonical validated-input hash;
- a missing/mismatched confirmation returns `needs_clarification` with a bounded spoken-safe summary and exact confirmation challenge;
- confirmation never widens A4 permissions or skips A6 where A6 itself requires approval.

### 4. Mobile field context provider

Add one C010 provider owning a new additive C001 `mobile` section. It activates only for explicit mobile/voice field requests and uses `JobsService.getById()` when a selected job exists.

It exposes only execution-relevant fields:

- job id/number/title/status/priority;
- service city/state (not full customer contact data);
- scheduled window;
- selected page/platform/connectivity metadata supplied by the authenticated caller's channel envelope.

The provider never imports Prisma or a request database client. JobsService/RLS remain the object-scope authority.

### 5. Kernel/controller wiring

The authenticated HTTP controller validates the channel envelope. The kernel:

- rejects disabled voice independently;
- carries safe interaction metadata into C001 request context;
- explicitly requests the `mobile` context section only for mobile/voice channels;
- enforces voice tool policy after tool resolution and A4 permission evaluation but before A6 execution;
- emits channel only as safe A10 metadata.

### 6. Mobile UX contract

The API response may include an additive voice confirmation challenge. Existing text clients remain unaffected. A mobile client can render the challenge as a large confirm/cancel action and resubmit the exact challenge after explicit user confirmation.

No microphone/audio implementation is required in the server repository for A14 readiness; the server contract is channel-agnostic and does not accept or persist raw audio.

## Tests

Required coverage:

- voice disabled independently while mobile/text remain available;
- voice medium/high-risk denial;
- low-risk read flow succeeds without confirmation;
- low-risk contextual mutation requires exact tool/version/input-hash confirmation;
- stale or changed-input confirmation fails;
- selected-job mobile context is actor/org scoped through JobsService;
- mobile provider omits customer contact details;
- mobile provider stays within its latency budget with injected service timing;
- controller rejects malformed channel/confirmation envelopes;
- A1-A13 contract/smoke suites remain green.

## Exit criteria

A14 is complete when protected exact-head CI proves:

1. voice can be disabled independently;
2. voice cannot execute medium/high-risk actions;
3. low-risk contextual voice actions require exact confirmation;
4. mobile/voice requests can obtain minimized field context via C010;
5. existing A4/A6/A10/A11 boundaries remain authoritative;
6. mobile contract and latency tests pass;
7. no A15 work is mixed into the A14 PR.

## Rollback

Set `ATHENA_VOICE_ENABLED` false to disable voice independently. The additive mobile context provider can be removed/disabled without affecting existing text Athena flows. No rollback changes A4 permissions, A6 approvals, or A12 business services.
