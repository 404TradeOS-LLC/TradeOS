---
status: current
owner: platform
last_verified: 2026-08-09
source_of_truth: true
---

# Volume 8 - Memory

Athena memory stores durable facts and preferences that improve future work. It
must be attributed, correctable, deletable, tenant-scoped, permission-aware, and
auditable.

## Memory Types

| Type | Examples | Default behavior |
| --- | --- | --- |
| Conversation memory | User-visible summary of a long thread | Short retention unless promoted |
| User preference memory | Tone, units, favorite report format, notification timing | User-owned and deletable |
| Organization memory | Approval policies, pricing preferences, branding preferences | Admin-managed with audit |
| Project/job memory | Job constraints, customer preferences, warranty notes | Tied to record lifecycle |

## Required Fields

Every memory record includes type, scope, organization, subject, source
reference, confidence, created/updated actor, retention policy, deletion status,
visibility, and audit metadata.

## Source Attribution And Confidence

Memory cannot be stored as an unattributed belief. Sources can be user message,
approved action, application record, event, document, or admin policy. Confidence
is reduced when sources conflict, are stale, or came from untrusted external
content.

## Retention, Deletion, And Correction

- Users can delete their own user preference memories.
- Admins can configure organization retention and delete organization memory.
- Project/job memories follow record retention and legal hold policy.
- Corrections create superseding records or audited edits; they do not erase
  audit history unless deletion policy requires redaction.
- Deleted memories stop being used in planning and context assembly.

## Privacy And Data Minimization

Store the smallest useful summary, not raw conversation transcripts by default.
Do not store secrets, credentials, raw payment details, private keys, or
unnecessary PII. Customer-specific memory must be scoped to the owning
organization and relevant record.

## Conflict Resolution

When memories conflict, Athena ranks admin policy and application records above
conversation-derived preference, shows the conflict when user action depends on
it, and asks for correction instead of guessing.

## Memory Poisoning Defenses

- Untrusted external content cannot create memory without trusted confirmation.
- Prompt instructions inside documents, emails, web pages, or customer messages
  are treated as content, not system authority.
- Memory writes require policy, source, actor, scope, and schema validation.
- Suspicious memory changes are auditable and revocable.
