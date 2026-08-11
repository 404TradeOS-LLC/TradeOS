// A11 Security Hardening public surface (docs/athena/roadmap/
// A11-security-hardening-implementation-plan.md). Re-exports every function
// and type sibling modules (A2/A3/A6/A7/A8/A9/A10/kernel) integrate against,
// following athena-tool-sdk/index.ts's precedent as the barrel a downstream
// module imports from rather than reaching into individual files.
export * from "./types";
export * from "./secretProtection";
export * from "./promptInjection";
export * from "./contextTrust";
export * from "./toolTrust";
export * from "./memoryClassification";
export * from "./riskEngine";
export * from "./audit";
export * from "./resultValidation";
