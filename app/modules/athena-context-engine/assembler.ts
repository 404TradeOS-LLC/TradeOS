import { scanContextSectionForInjection } from "../athena-security/contextTrust";
import type { AthenaProviderSection, AthenaWarning } from "../athena-kernel/types";
import { ATHENA_PROVIDER_AGGREGATE_BUDGET } from "./budget";
import { AthenaContextCache, buildAthenaContextCacheKey } from "./cache";
import {
  AthenaContextProviderFetchError,
  athenaContextCriticalProviderFailureWarning,
  athenaContextPossibleInjectionWarning,
  athenaContextProviderCancelledWarning,
  athenaContextProviderDeniedWarning,
  athenaContextProviderInvalidResultWarning,
  athenaContextProviderTimeoutWarning,
  athenaContextProviderUnexpectedErrorWarning,
} from "./errors";
import { hasAllRequiredFeatureFlags, hasAllRequiredPermissions } from "./policy";
import type { AthenaContextRegistry } from "./registry";
import { assertValidContextProviderFetchResult } from "./resultValidation";
import {
  AthenaContextAssemblyAudit,
  AthenaContextAssemblyRequest,
  AthenaContextAssemblyResult,
  AthenaContextProviderDefinition,
  AthenaContextSectionName,
} from "./types";

class AthenaContextProviderAbortedError extends Error {
  constructor(public readonly reason: "timeout" | "cancelled") {
    super(`Athena context provider fetch aborted: ${reason}`);
  }
}

async function raceWithTimeout<T>(work: (signal: AbortSignal) => Promise<T>, timeoutMs: number, clientSignal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  let settled = false;
  let rejectAbort!: (error: AthenaContextProviderAbortedError) => void;
  const abortPromise = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const fireAbort = (reason: "timeout" | "cancelled") => {
    if (settled) return;
    settled = true;
    controller.abort();
    rejectAbort(new AthenaContextProviderAbortedError(reason));
  };
  const onClientAbort = () => fireAbort("cancelled");
  clientSignal?.addEventListener("abort", onClientAbort);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (clientSignal?.aborted) {
      onClientAbort();
      return await abortPromise;
    }
    timer = setTimeout(() => fireAbort("timeout"), timeoutMs);
    return await Promise.race([work(controller.signal), abortPromise]);
  } finally {
    settled = true;
    clearTimeout(timer);
    clientSignal?.removeEventListener("abort", onClientAbort);
  }
}

function isFieldInteraction(request: AthenaContextAssemblyRequest): boolean {
  return request.interaction?.channel === "mobile" || request.interaction?.channel === "voice";
}

function isActivated(provider: AthenaContextProviderDefinition<unknown>, request: AthenaContextAssemblyRequest): boolean {
  if (
    isFieldInteraction(request)
    && provider.section !== "mobile"
    && (provider.sensitivity === "confidential" || provider.sensitivity === "restricted")
  ) {
    return false;
  }

  switch (provider.activation) {
    case "eager_minimal": return true;
    case "lazy_intent": return provider.allowedIntents.some((intent) => request.requestedIntents.includes(intent));
    case "explicit_only": return request.explicitSections.includes(provider.section);
  }
}

function estimateBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value) ?? "null", "utf8");
}

function buildDeniedSection(provider: AthenaContextProviderDefinition<unknown>, now: string): AthenaProviderSection {
  return {
    status: "denied",
    freshness: { status: "unavailable", fetchedAt: now, cacheHit: false },
    sensitivity: provider.sensitivity,
    source: { providerId: provider.id, providerVersion: provider.version },
    data: null,
    omittedFields: [],
    maxItems: provider.maxItems,
    maxBytes: provider.maxBytes,
  };
}

function buildFailureSection(provider: AthenaContextProviderDefinition<unknown>, now: string, status: "degraded" | "omitted", truncationReason?: string): AthenaProviderSection {
  return {
    status,
    freshness: { status: "unavailable", fetchedAt: now, cacheHit: false },
    sensitivity: provider.sensitivity,
    source: { providerId: provider.id, providerVersion: provider.version },
    data: null,
    omittedFields: [],
    maxItems: provider.maxItems,
    maxBytes: provider.maxBytes,
    ...(truncationReason ? { truncationReason } : {}),
  };
}

function buildOmittedSection(provider: AthenaContextProviderDefinition<unknown>, now: string, truncationReason: string): AthenaProviderSection {
  return {
    status: "omitted",
    freshness: { status: "live", fetchedAt: now, cacheHit: false },
    sensitivity: provider.sensitivity,
    source: { providerId: provider.id, providerVersion: provider.version },
    data: null,
    omittedFields: [],
    maxItems: provider.maxItems,
    maxBytes: provider.maxBytes,
    truncationReason,
  };
}

function warningForFailure(reason: string, providerId: string): AthenaWarning {
  switch (reason) {
    case "timeout": return athenaContextProviderTimeoutWarning(providerId);
    case "cancelled": return athenaContextProviderCancelledWarning(providerId);
    case "invalid_result": return athenaContextProviderInvalidResultWarning(providerId);
    default: return athenaContextProviderUnexpectedErrorWarning(providerId);
  }
}

function cacheHitSection(section: AthenaProviderSection): AthenaProviderSection {
  return { ...section, freshness: { ...section.freshness, status: "fresh", cacheHit: true } };
}

export async function assembleAthenaContext(registry: AthenaContextRegistry, request: AthenaContextAssemblyRequest, cache: AthenaContextCache<AthenaProviderSection> = new AthenaContextCache()): Promise<AthenaContextAssemblyResult> {
  const sections: Partial<Record<AthenaContextSectionName, AthenaProviderSection>> = {};
  const warnings: AthenaWarning[] = [];
  const audit: AthenaContextAssemblyAudit[] = [];
  let stoppedByCriticalFailure = false;
  let providerCount = 0;
  let aggregateBytes = 0;
  let aggregateEstimatedTokens = 0;

  const tryIncludeProviderSection = (
    provider: AthenaContextProviderDefinition<unknown>,
    section: AthenaProviderSection,
    now: string
  ): boolean => {
    const sectionBytes = estimateBytes(section);
    const sectionEstimatedTokens = Math.ceil(sectionBytes / 4);
    if (
      providerCount + 1 > ATHENA_PROVIDER_AGGREGATE_BUDGET.maxProviderCount
      || aggregateBytes + sectionBytes > ATHENA_PROVIDER_AGGREGATE_BUDGET.maxBytes
      || aggregateEstimatedTokens + sectionEstimatedTokens > ATHENA_PROVIDER_AGGREGATE_BUDGET.maxEstimatedTokens
    ) {
      sections[provider.section] = buildOmittedSection(provider, now, "aggregate_context_budget_exceeded");
      audit.push({ section: provider.section, providerId: provider.id, version: provider.version, reasonCode: "omitted" });
      return false;
    }

    sections[provider.section] = { ...section, estimatedTokens: sectionEstimatedTokens };
    providerCount += 1;
    aggregateBytes += sectionBytes;
    aggregateEstimatedTokens += sectionEstimatedTokens;
    return true;
  };

  for (const provider of registry.list()) {
    if (stoppedByCriticalFailure) {
      audit.push({ section: provider.section, providerId: provider.id, version: provider.version, reasonCode: "stopped_by_critical_failure" });
      continue;
    }
    if (!isActivated(provider, request)) {
      audit.push({ section: provider.section, providerId: provider.id, version: provider.version, reasonCode: "not_activated" });
      continue;
    }
    const authorized = hasAllRequiredPermissions(request.actor.role, provider.permissions) && hasAllRequiredFeatureFlags(provider.requiredFeatureFlags, request.featureFlags);
    if (!authorized) {
      sections[provider.section] = buildDeniedSection(provider, new Date().toISOString());
      warnings.push(athenaContextProviderDeniedWarning(provider.section));
      audit.push({ section: provider.section, providerId: provider.id, version: provider.version, reasonCode: "denied" });
      continue;
    }

    if (providerCount >= ATHENA_PROVIDER_AGGREGATE_BUDGET.maxProviderCount) {
      sections[provider.section] = buildOmittedSection(provider, new Date().toISOString(), "aggregate_context_provider_limit_exceeded");
      audit.push({ section: provider.section, providerId: provider.id, version: provider.version, reasonCode: "omitted" });
      continue;
    }

    const scopedInput = { selectedScope: request.selectedScope };
    const cacheKey = provider.cacheKeyPolicy === "tenant_actor_permission_input"
      ? buildAthenaContextCacheKey({
          orgId: request.orgId,
          actorUserId: request.actor.userId,
          actorRole: request.actor.role,
          effectivePermissions: request.permissions,
          providerId: provider.id,
          providerVersion: provider.version,
          scopedInput,
        })
      : undefined;
    const cached = cacheKey ? cache.get(cacheKey) : undefined;
    if (cached) {
      const cachedSection = cacheHitSection(cached);
      if (!tryIncludeProviderSection(provider, cachedSection, new Date().toISOString())) continue;
      if (cached.injectionScan?.suspicious) warnings.push(athenaContextPossibleInjectionWarning(provider.id, cached.injectionScan.matchedPatternNames));
      audit.push({ section: provider.section, providerId: provider.id, version: provider.version, reasonCode: "activated" });
      continue;
    }

    const fetchedAt = new Date();
    const deadline = new Date(fetchedAt.getTime() + provider.timeoutMs);
    let outcome: { ok: true; section: AthenaProviderSection } | { ok: false; reason: string };
    try {
      const result = await raceWithTimeout(
        (signal) => provider.provide({
          orgId: request.orgId,
          actor: request.actor,
          selectedScope: request.selectedScope,
          interaction: request.interaction,
          deadline,
          cancellationSignal: signal,
        }),
        provider.timeoutMs,
        request.clientSignal
      );
      try {
        assertValidContextProviderFetchResult(result);
      } catch {
        throw new AthenaContextProviderFetchError("invalid_result", `Athena context provider "${provider.id}" returned an invalid fetch result`);
      }
      if (result.itemCount > provider.maxItems) {
        outcome = { ok: false, reason: "invalid_result" };
      } else {
        const bytes = estimateBytes(result.data);
        if (bytes > provider.maxBytes) {
          sections[provider.section] = buildOmittedSection(provider, fetchedAt.toISOString(), "max_bytes_exceeded");
          audit.push({ section: provider.section, providerId: provider.id, version: provider.version, reasonCode: "omitted" });
          continue;
        }
        const injectionScan = scanContextSectionForInjection(result.data);
        const section: AthenaProviderSection = {
          status: "available",
          freshness: {
            status: "live",
            fetchedAt: fetchedAt.toISOString(),
            cacheHit: false,
            sourceVersion: result.sourceVersion,
            sourceHash: result.sourceHash,
            ...(cacheKey ? { ttlMs: provider.freshnessTtlMs, expiresAt: new Date(fetchedAt.getTime() + provider.freshnessTtlMs).toISOString() } : {}),
          },
          sensitivity: provider.sensitivity,
          source: { providerId: provider.id, providerVersion: provider.version },
          data: result.data,
          omittedFields: result.omittedFields,
          maxItems: provider.maxItems,
          maxBytes: provider.maxBytes,
          estimatedTokens: Math.ceil(bytes / 4),
          injectionScan,
        };
        if (cacheKey) cache.set(cacheKey, section, provider.freshnessTtlMs);
        if (injectionScan.suspicious) warnings.push(athenaContextPossibleInjectionWarning(provider.id, injectionScan.matchedPatternNames));
        outcome = { ok: true, section };
      }
    } catch (error) {
      const reason = error instanceof AthenaContextProviderAbortedError ? error.reason : error instanceof AthenaContextProviderFetchError ? error.reason : "unexpected_error";
      outcome = { ok: false, reason };
    }

    if (outcome.ok) {
      if (!tryIncludeProviderSection(provider, outcome.section, fetchedAt.toISOString())) continue;
      audit.push({ section: provider.section, providerId: provider.id, version: provider.version, reasonCode: "activated" });
      continue;
    }
    if (provider.criticality === "critical" || provider.failureBehavior === "stop") {
      stoppedByCriticalFailure = true;
      warnings.push(athenaContextCriticalProviderFailureWarning(provider.id));
      audit.push({ section: provider.section, providerId: provider.id, version: provider.version, reasonCode: "stopped_by_critical_failure" });
      continue;
    }
    const status = provider.failureBehavior === "degrade" ? "degraded" : "omitted";
    sections[provider.section] = buildFailureSection(provider, fetchedAt.toISOString(), status, `provider_${outcome.reason}`);
    warnings.push(warningForFailure(outcome.reason, provider.id));
    audit.push({ section: provider.section, providerId: provider.id, version: provider.version, reasonCode: status });
  }

  return { sections, warnings, audit, stoppedByCriticalFailure };
}
