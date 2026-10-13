# TradeOS Figma-to-code execution ledger

Checkpoint: 2026-10-13. Repository: `404TradeOS-LLC/TradeOS`.
Canonical Figma: https://www.figma.com/design/xImUa9CYUjx3Cb3zTrkfnY

## Reconciliation

- Clean main `6096d806782382c987c7e0c15df1da9cb4d30ad4` fetched. Repository, upstream and linked worktree inspected.
- **EXISTING_WORK_FOUND**: continue draft [PR #731](https://github.com/404TradeOS-LLC/TradeOS/pull/731), branch `feat/p0-first-estimate-quickstart-20261013`; no competing implementation.
- Other open PRs #700 (Davis-Bacon) and #702 (Field contracts) have distinct scope. Closed search surfaced Entry #640 and Settings #575, already merged with different scope.
- Allowed: first-estimate route/form, dedicated frontend action/workflow/tests and implementation/current-state/handoff docs. Excluded: backend/schema/migrations, auth/RLS policy, pricing/payment authority, dependencies/infrastructure.
- Acceptance: retain typed scope and confirmed Project on partial failure, reauthorize resume, never repeat creation POSTs on resume, show pending/recovery controls, preserve review-first estimating.

## Discovery ledger

All 21 page names were retrieved through the Plugin API. The initial metadata call exposed only two loaded pages. Frame directories were inspected for the rows below. **Directory discovery is not frame parity, integration or production verification.** Every unaudited frame remains an open reconciliation item.

| Priority | Surface / page ID | Discovered designs and current evidence |
| --- | --- | --- |
| P0 | Entry + Today / `4:6` | Canonical desktop/tablet/mobile Entry, response/boot states, command board, Needs You. Entry #640 merged; complete response/boot and deployed parity audit pending. Conditional partial boot remains TARGET. |
| P0 | Universal Create / Patterns `4:5` | Shell, record and workflow contracts. Existing navigation/Create code present; real destinations and states require audit. |
| P0 | Onboarding / `54:3` | Desktop `58:2`, mobile `59:4`, 1024/768 variants, explicitly TARGET ONLY. #731 CODED and locally TESTED, not live-integrated/merged/deployed/verified. Full wizard, defaults and visual parity unfinished. |
| P0 | Estimates / `4:10` | 309 top-level frames, canonical Scope/Items/Price/Review, resolution, clarification and build-ready contract. Existing workspace present; full frame mapping and persisted journey verification pending. |
| P1 | Costbook / `4:14` | Pricing trust, classification and supplier-evidence match review. Existing implementation; nested targets and data/mapping boundaries require detailed reconciliation. |
| P1 | CRM / `4:7` | Canonical overview; follow-up/pipeline/empty/partial build-ready states. Existing code; parity/action evidence pending. |
| P1 | Customer / `4:8` | Customer workspace and S052 Customer → Project. Existing code; certification includes explicit GAP labels. Runtime audit pending. |
| P1 | Lead / `4:9` | New lead/site visit/estimate handoff and qualification. Existing Project-backed Lead behavior; detailed audit pending. |
| P1 | Portal + Copperline / `4:16` | Canonical project/proposal/contract/invoice/access and document family. Archived targets excluded. Frames alone do not prove generation/payment capability. Detailed reconciliation pending. |
| P1 | Schedule / `4:12` | Day/mobile Today; reschedule/conflict/assignment. Existing scheduling; preview/commit/permission and responsive evidence pending. |
| P1 | Jobs/Field / `4:11` | Canonical lifecycle/notes and broader capture/offline/issue/time flows. Existing lifecycle; #702 is contracts only. Rich targets require supported persistence/security before implementation. No offline support asserted. |
| P1 | Money / `4:13` | Invoice states, payment fixtures and expense capture. Existing invoice contracts; viewed/expense/receipt states require capability reconciliation. |
| P1 | Athena / `4:15` | Scoped workspace/sheet, confirmation/saving/success/failure. Existing advisory/approval runtime; exact action/recovery evidence pending. |
| P1 | Settings / `54:2` | Canonical control center/mobile pricing; #575 merged. No duplicate implementation; current parity/permission audit pending. |
| P2 | Components `4:4`, Foundations `4:3`, Patterns `4:5` | Tokens/primitives/ControlDock/ScopeComposer/trust/motion. Existing primitives inspected; per-component fidelity and motion reconciliation pending. |

Cover, Getting Started, Mobile, States and Archive page names were also discovered. Getting Started authority/QA boards were identified; Mobile/States/Archive were not audited frame by frame. Archive is not an implementation queue.

## Maturity and limits

- #731 repair is CODED / locally TESTED at workflow seams. Existing authenticated APIs are wired; actual database integration is unverified.
- Eight behavioral tests, 487 web tests, ESLint, TypeScript and production build pass. Docs ownership/preflight pass.
- Browser plugin runtime is unavailable. Regular Playwright attempted; Chromium v1248 ZIP is invalid. Screenshots/keyboard/console/viewports and authenticated flow evidence remain uncollected.
- No production data write, OAuth, migration or pricing approval performed. No #731 merge/deployment/production verification claim.
- Lost first Project response without ID, reload and cross-tab submissions remain limitations. Resume itself repeats neither POST.

## Next five TODOs

1. Verify #731 final-head CI, review, currency and legitimate merge gates; merge only when the repository contract permits.
2. Restore a working browser runner and run sanitized authenticated Preview at 390/768/1024/1440: scope reload, saved-project recovery, delayed commit and denied tenant/role.
3. Audit Entry response/boot designs against login/auth routes; fix the first supported P0 mismatch in a bounded lane after overlap search.
4. Audit actual Scope → Athena → reviewed Items → Price → Review persistence; preserve explicit Apply and pricing authority.
5. Continue canonical P0/P1 workflow reconciliation; TARGET designs stay open until capability/data contracts support them.
