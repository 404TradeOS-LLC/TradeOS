import type { AthenaEventReference } from "./types";

// Constructs an AthenaEventReference (C003's `events` field / C008 identity
// pair) only. Deliberately the single event-related export this module
// offers - there is no emitEvent()/publishDomainEvent() anywhere in this
// package (docs/athena/roadmap/A9-tool-sdk-implementation-plan.md
// "Non-goals"). Canonical business events remain published by application
// services per A8/ADR-007 (docs/athena/10-events/README.md "Publisher And
// Subscriber Rules": "Tool-result `events` are references to
// service-published events unless a tool has explicit delegated publisher
// authority"). The correct call sequence is:
//
//   tool.execute() -> application service call -> service publishes the
//   canonical event and returns its {type, id} -> eventRef(type, id) wraps
//   that reference for the tool's own successResult({ events: [...] }).
//
// eventRef() never creates, looks up, or infers an event on its own; it has
// no side effect and cannot be called before a service has actually
// produced the reference being wrapped.
export function eventRef(type: string, id: string): AthenaEventReference {
  return { type, id };
}
