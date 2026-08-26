---
status: archived
superseded_by: docs/ROADMAP.md
do_not_use_for_implementation: true
---

# Next Steps

Last updated: 2026-07-03

## Immediate RC1 priorities

1. Remove or complete the last contractor-visible placeholder surfaces that still weaken launch trust.
2. Decide whether supplier integrations ship as manual review infrastructure only or whether one live connector is required for RC1.
3. Finish release-facing documentation and repository cleanup so the repo reads like a production candidate instead of an internal build log.
4. Run the full release verification pass in a machine or CI environment that has `psql` available for integration testing.
5. Produce release assets: `CHANGELOG.md` and `RELEASE_NOTES_RC1.md`.

## Recommended next engineering slice after RC1 docs

The highest-value product hardening items after the current documentation phase are:

1. Persist backend-owned lifecycle events so project timeline and dashboard activity do not rely only on derived timestamps.
2. Add customer-facing change-order acceptance artifacts and signed acknowledgment flow.
3. Improve project-document structure for closeout packages, permits, and signed deliverables.
4. Add AI suggestion acceptance/rejection telemetry so estimate-assist quality can be measured in production.
5. Decide on the final RC1 scope for warranty: launch it as closeout/supporting records only, or promote it into a first-class backend domain.

## Explicitly out of scope during RC1 hardening

Do not start these while RC1 is still open unless priorities change:

- scheduling or dispatch workflows
- payroll or accounting integrations
- inventory management
- CRM redesign
- architecture rewrites
- framework migrations
- knowledge-runtime persistence rewrites unrelated to launch blockers

## Next milestone recommendation

If RC1 verification closes cleanly, the recommended sequence is:

1. `RC1`
2. `v1.0`
3. `v1.1`
4. `v2.0`

### Suggested milestone intent

- `RC1`
  Production readiness, stability, launch polish, release documentation, deployment confidence
- `v1.0`
  General-availability launch with resolved RC blockers and final release packaging
- `v1.1`
  Post-launch operational improvements: lifecycle event persistence, document/versioning refinement, AI review telemetry
- `v2.0`
  Larger product expansion only after launch operations are stable
