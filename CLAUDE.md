# Claude Guidance

Claude uses the same first-party operating system as every other TradeOS agent.

Start with:

1. [AGENTS.md](AGENTS.md)
2. [docs/TRADEOS_BIBLE.md](docs/TRADEOS_BIBLE.md)
3. [docs/ENGINEERING_COMMAND_CENTER.md](docs/ENGINEERING_COMMAND_CENTER.md)
4. [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md)
5. [docs/SPRINT_BACKLOG.md](docs/SPRINT_BACKLOG.md)
6. [docs/SESSION_HANDOFF.md](docs/SESSION_HANDOFF.md)
7. [docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md](docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md)
8. [docs/REPOSITORY_GOVERNANCE.md](docs/REPOSITORY_GOVERNANCE.md)

Do not use this file as a rolling session log. Immediate continuity belongs in `docs/SESSION_HANDOFF.md`; implementation truth belongs in `docs/CURRENT_STATE.md`; doctrine belongs in the Bible.

The previous long-form Claude session log contained useful history, but it also referenced obsolete `app/api/**` paths, archived planning docs, and pre-Bible current-state claims. It remains available in git history for archaeology only.

Current active Claude lanes must be verified live before editing. Do not touch `packages/knowledge-engine/**` from unrelated branches, and do not begin Phase C duplicate-tree cleanup without explicit founder authorization.

For scheduled or autonomous implementation, run the mandatory reconciliation
gate in `docs/agent-prompts/AUTONOMY_RECONCILIATION.md` before creating or
recreating any branch. Repository and live PR state are authoritative; a branch
named by historical task input is not proof that the branch should exist.
