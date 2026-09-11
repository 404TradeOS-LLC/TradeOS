import { createAthenaContextRegistry } from "../athena-context-engine/registry";
import type { AthenaContextRegistry } from "../athena-context-engine/registry";
import { createCostbookProvider } from "../athena-context-engine/providers/costbookProvider";
import { createCustomerProvider } from "../athena-context-engine/providers/customerProvider";
import { createDispatchProvider } from "../athena-context-engine/providers/dispatchProvider";
import { createEstimateProvider } from "../athena-context-engine/providers/estimateProvider";
import { createKnowledgeEngineProvider } from "../athena-context-engine/providers/knowledgeEngineProvider";
import { createMemoryContextProvider } from "../athena-context-engine/providers/memoryProvider";
import { createMobileFieldProvider } from "../athena-context-engine/providers/mobileFieldProvider";

export function createLiveAthenaContextRegistry(): AthenaContextRegistry {
  const registry = createAthenaContextRegistry();
  registry.register(createCustomerProvider());
  registry.register(createDispatchProvider());
  registry.register(createEstimateProvider());
  registry.register(createKnowledgeEngineProvider());
  registry.register(createMemoryContextProvider());
  registry.register(createCostbookProvider());
  registry.register(createMobileFieldProvider());
  return registry;
}
