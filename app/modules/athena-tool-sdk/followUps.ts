import type { AthenaFollowUp } from "./types";

// Typed constructor for the existing AthenaFollowUp shape (C003):
// `kind: "question" | "action"` plus `label`. A9 does not add a new
// follow-up kind or field - see docs/athena/roadmap/
// A9-tool-sdk-implementation-plan.md's non-goals ("A9 does not expand the
// conversation UX contract").
export interface AthenaFollowUpInput {
  kind: "question" | "action";
  label: string;
}

export function followUp(input: AthenaFollowUpInput): AthenaFollowUp {
  return { kind: input.kind, label: input.label };
}
