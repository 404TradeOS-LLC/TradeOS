// A plan can never reference an unverified tool (docs/athena/contracts/
// README.md C004: "every step must reference a registered tool/version or a
// user question"). Thrown, not silently dropped, so a stale/removed
// candidate tool fails the plan build loudly rather than producing a plan
// with a missing step.
export class AthenaPlannerError extends Error {
  constructor(message: string) {
    super(message);
  }
}
