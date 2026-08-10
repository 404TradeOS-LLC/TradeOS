import { createAthenaContextRegistry } from "../athena-context-engine/registry";
import type { AthenaContextRegistry } from "../athena-context-engine/registry";
import { createDispatchProvider } from "../athena-context-engine/providers/dispatchProvider";
import { createKnowledgeEngineProvider } from "../athena-context-engine/providers/knowledgeEngineProvider";

// First live registration of A3's context providers anywhere - A3's own
// plan doc explicitly shipped assembleAthenaContext() unwired ("No Live
// Kernel Wiring"). This is A5's job. Both providers default to their real
// application-service dependencies (JobsService, KnowledgeRuntimeService) -
// callers that need a fake registry for tests (no live DB session) should
// build their own via createAthenaContextRegistry() and register fixture/
// injected-service providers directly instead of using this factory.
export function createLiveAthenaContextRegistry(): AthenaContextRegistry {
  const registry = createAthenaContextRegistry();
  registry.register(createDispatchProvider());
  registry.register(createKnowledgeEngineProvider());
  return registry;
}
