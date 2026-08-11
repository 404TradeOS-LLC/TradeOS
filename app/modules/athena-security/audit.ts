import { redactSecrets } from "./secretProtection";
import type { AthenaSecurityDecision } from "./types";

// Security audit evidence (task brief "7. Security audit evidence: Use
// A10... Capture: security decision, reason, actor, organization, action,
// tool, timestamp, outcome. Never capture private reasoning."). This module
// deliberately does NOT call athena-observability or persist anything
// itself - athena-security has no dependency on any sibling Athena module
// (see this module's own import-boundary test), and A10 already owns the
// one telemetry system (docs/athena/roadmap/
// A10-observability-implementation-plan.md). buildAthenaSecurityAuditMetadata
// only shapes a plain, already-redacted metadata object; the caller (e.g.
// athena-kernel/service.ts) attaches it to whichever C011 span it is
// already emitting at that point (mirroring exactly how it already attaches
// A4's own decision/reasonCode as metadata) via the existing
// recordAthenaTelemetry path - no second telemetry write path is created.
//
// Every field below is an ID, a fixed enum value, a reason-code string, or
// a detector/pattern *name* - never a raw prompt, tool input value, model
// output, or chain-of-thought, satisfying the task brief's "Absolute
// security rules". redactSecrets() is run over the result regardless, as
// the same defense-in-depth posture athena-kernel/telemetry.ts's own
// sanitizeMetadata already applies to every other span's metadata.
export function buildAthenaSecurityAuditMetadata(decision: AthenaSecurityDecision): Record<string, unknown> {
  const raw = {
    securityDecision: decision.decision,
    securityRiskLevel: decision.riskLevel,
    securityReasons: decision.reasons,
    securityRequiredControls: decision.requiredControls,
    securityMetadata: decision.metadata,
  };
  return redactSecrets(raw).data;
}
