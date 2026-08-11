import { scanContextSectionForInjection } from "../athena-security/contextTrust";
import type { AthenaProviderSection, AthenaWarning } from "../athena-kernel/types";
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

// Races a provider's fetch() against a dispatcher-owned deadline, same
// pattern as athena-tool-registry/dispatcher.ts's raceWithTimeout
// (duplicated rather than shared - see that file's precedent and the A3
// plan's non-goal against a generic provider/tool abstraction). Includes
// the already-aborted short-circuit fix from that module's own review
// history: never invoke fetch() at all once the caller's signal is already
// aborted on entry.
async function raceWithTimeout<T>(work: (signal: AbortSignal) => Promise<T>, timeoutMs: number, clientSignal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  let settled = false;
  let rejectAbort!: (error: AthenaContextProviderAbortedError) => void;

  const abortPromise = new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });

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

function isActivated(provider: AthenaContextProviderDefinition<unknown>, request: AthenaContextAssemblyRequest): boolean {
  switch (provider.activation) {
    case "eager_minimal":
      return true;
    case "lazy_intent":
      return provider.allowedIntents.some((intent) => request.requestedIntents.includes(intent));
    case "explicit_only":
      return request.explicitSections.includes(provider.section);
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

// failureBehavior maps directly onto status by name ("degrade" ->
// "degraded", "omit" -> "omitted") so a provider-failure omission and a
// budget-exceeded omission both read as the same status - both mean "this
// section is not present in usable form, by design," just for different
// reasons, which truncationReason/the audit trail disambiguate further.
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
    case "timeout":
      return athenaContextProviderTimeoutWarning(providerId);
    case "cancelled":
      return athenaContextProviderCancelledWarning(providerId);
    case "invalid_result":
      return athenaContextProviderInvalidResultWarning(providerId);
    default:
      return athenaContextProviderUnexpectedErrorWarning(providerId);
  }
}

function cacheHitSection(section: AthenaProviderSection): AthenaProviderSection {
  return {
    ...section,
    freshness: {
      ...section.freshness,
      status: "fresh",
      cacheHit: true,
    },
  };
}

// Orchestrates context assembly (docs/athena/roadmap/
// A3-context-engine-implementation-plan.md "Required Backend Seams" /
// "Degraded And Partial Context"). Iterates registry.list() (not
// discover()) so a permission-denied provider gets an explicit
// status: "denied" section instead of being silently absent - see
// registry.ts's comment on why. Processes providers sequentially: A3 has
// only two real providers, and sequential processing keeps
// stop-on-critical-failure semantics simple; parallelizing is a future
// optimization once provider count and athena:perf both exist.
export async function assembleAthenaContext(registry: AthenaContextRegistry, request: AthenaContextAssemblyRequest, cache: AthenaContextCache<AthenaProviderSection> = new AthenaContextCache()): Promise<AthenaContextAssemblyResult> {
  const sections: Partial<Record<AthenaContextSectionName, AthenaProviderSection>> = {};
  const warnings: AthenaWarning[] = [];
  const audit: AthenaContextAssemblyAudit[] = [];
  let stoppedByCriticalFailure = false;

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

    const scopedInput = { selectedScope: request.selectedScope };
    const cacheKey =
      provider.cacheKeyPolicy === "tenant_actor_permission_input"
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
      sections[provider.section] = cacheHitSection(cached);
      // Re-emit the same A11 advisory warning a cache hit's identical
      // content already earned at fetch time - see the injectionScan
      // module comment on AthenaProviderSection (athena-kernel/types.ts)
      // for why this is stored on the section rather than only computed
      // inline on the fresh-fetch path below.
      if (cached.injectionScan?.suspicious) {
        warnings.push(athenaContextPossibleInjectionWarning(provider.id, cached.injectionScan.matchedPatternNames));
      }
      audit.push({ section: provider.section, providerId: provider.id, version: provider.version, reasonCode: "activated" });
      continue;
    }

    const fetchedAt = new Date();
    const deadline = new Date(fetchedAt.getTime() + provider.timeoutMs);

    let outcome: { ok: true; section: AthenaProviderSection } | { ok: false; reason: string };
    try {
      const result = await raceWithTimeout(
        (signal) =>
          provider.fetch({
            orgId: request.orgId,
            actor: request.actor,
            selectedScope: request.selectedScope,
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
        // A11 hardening (athena-security/contextTrust.ts's
        // scanContextSectionForInjection): advisory-only classification,
        // computed once here (before caching) and stored on the section
        // itself so a later cache hit for this identical content re-emits
        // the same warning instead of it silently going stale for the rest
        // of provider.freshnessTtlMs - see the cache-hit branch above and
        // the injectionScan module comment on AthenaProviderSection
        // (athena-kernel/types.ts). Never omits, truncates, or otherwise
        // alters `section` because of a match - retrieved content, even
        // content that happens to look like an instruction, is still
        // legitimate data Athena may cite/summarize (09-security's
        // "content, not authority" framing); this only adds a warning so a
        // caller/reviewer can see it.
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
        if (injectionScan.suspicious) {
          warnings.push(athenaContextPossibleInjectionWarning(provider.id, injectionScan.matchedPatternNames));
        }
        outcome = { ok: true, section };
      }
    } catch (error) {
      const reason = error instanceof AthenaContextProviderAbortedError ? error.reason : error instanceof AthenaContextProviderFetchError ? error.reason : "unexpected_error";
      outcome = { ok: false, reason };
    }

    if (outcome.ok) {
      sections[provider.section] = outcome.section;
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
