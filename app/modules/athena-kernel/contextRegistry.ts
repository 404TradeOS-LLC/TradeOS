import { createAthenaContextRegistry } from "../athena-context-engine/registry";
import type { AthenaContextRegistry } from "../athena-context-engine/registry";
import { createCostbookProvider } from "../athena-context-engine/providers/costbookProvider";
import { createCustomerProvider } from "../athena-context-engine/providers/customerProvider";
import { createDispatchProvider } from "../athena-context-engine/providers/dispatchProvider";
import { createEstimateProvider } from "../athena-context-engine/providers/estimateProvider";
import { createKnowledgeEngineProvider } from "../athena-context-engine/providers/knowledgeEngineProvider";
import { createMemoryContextProvider } from "../athena-context-engine/providers/memoryProvider";

// First live registration of A3's context providers anywhere - A3's own
// plan doc explicitly shipped assembleAthenaContext() unwired ("No Live
// Kernel Wiring"). This is A5's job. All three providers default to their
// real application-service dependencies (JobsService, KnowledgeRuntimeService,
// AthenaMemoryService) - callers that need a fake registry for tests (no
// live DB session) should build their own via createAthenaContextRegistry()
// and register fixture/injected-service providers directly instead of using
// this factory. The memory provider (A7) is dormant in production exactly
// like the other two: its "memory_preferences" allowedIntents value is not
// yet produced by A5's classifier, so it never activates until a future
// router/planner change requests it.
export function createLiveAthenaContextRegistry(): AthenaContextRegistry {
  const registry = createAthenaContextRegistry();
  registry.register(createCustomerProvider());
  registry.register(createDispatchProvider());
  registry.register(createEstimateProvider());
  registry.register(createKnowledgeEngineProvider());
  registry.register(createMemoryContextProvider());
  registry.register(createCostbookProvider());
  return registry;
}
