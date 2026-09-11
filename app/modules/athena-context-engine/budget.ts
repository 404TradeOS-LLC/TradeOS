export const ATHENA_CONTEXT_BUDGET = {
  maxBytes: 131_072,
  maxEstimatedTokens: 32_768,
  maxProviderCount: 4,
} as const;

// Reserve headroom for the kernel-owned request/org/user/permission/scope
// envelope so provider data cannot consume the entire C001 context budget.
export const ATHENA_PROVIDER_AGGREGATE_BUDGET = {
  maxBytes: 98_304,
  maxEstimatedTokens: 24_576,
  maxProviderCount: 4,
} as const;
