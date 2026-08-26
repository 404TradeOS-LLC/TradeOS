---
status: archived
superseded_by: docs/agent-prompts/AGENT_COMPLETION_CHECKLIST.md
do_not_use_for_implementation: true
---

# TradeOS Session Handoff

## Product Focus
- TradeOS MVP is a project-first preconstruction assistant.
- The narrow flow is `Customer -> Project -> AI Intake -> Proposal -> PDF`.
- Keep AI behind the service boundary and keep the project as the primary workspace.

## What Is Done
- Project-first customer/project flow is in place.
- Site visit intake stores notes, measurements, AI questions, missing info, and confidence.
- Proposal drafts can be created from project + intake context, edited, previewed, sent, accepted, rejected, and turned into contracts.
- PDF preview/download works for proposals and contracts.
- Supabase-backed photo uploads are now wired into intake.
- Project photos render through Storage-aware server helpers with public/signed URL support.
- Intake photos can be deleted again from the UI, with Storage object cleanup and metadata cleanup.

## Current Implementation Notes
- `site_visits` and `project_files` are the intake data backbone.
- `project_files.storagePath` is the canonical Storage reference.
- The app currently supports both legacy `fileUrl` rows and Storage-backed rows.
- Uploads are limited to image files, capped at 4 per intake save, and kept under 6MB each for the current MVP path.
- Storage rendering falls back to `fileUrl` if `storagePath` is missing or signed URL generation fails.

## Key Files
- `web/src/app/actions/projects.ts` (project intake action)
- `web/src/components/projects/site-visit-form.tsx` (site visit form)
- `web/src/components/projects/project-photo-panel.tsx` (shared project photo gallery)
- `web/src/lib/storage.ts` (storage resolver)
- `web/src/app/(app)/projects/[id]/intake/page.tsx` (intake page)
- `web/src/components/proposals/proposal-context-panel.tsx` (proposal context panel)
- `app/backend/controllers/projects.controller.ts` (project files API)

## Verification
- `npm run lint` passes in `web`.
- `npm run lint` passes in `app`.
- Earlier proposal and contract service tests passed after the workflow changes.
- No live browser smoke test was run for the latest photo-delete/storage-resolve slice.

## Best Next Slice
- Add replace/edit behavior for project photos, or
- Add inline upload/delete error handling and progress feedback, or
- Run a browser smoke test with a real Supabase bucket and confirm the gallery works end to end.

## Watch Outs
- Do not treat the project-file `fileUrl` as the only source of truth anymore; `storagePath` is the important field for Storage-backed rows.
- Keep `SUPABASE_STORAGE_BUCKET_PUBLIC` aligned with the actual bucket policy.
- Do not loosen the file validation without checking the MVP scope first.
