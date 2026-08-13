import { AsyncLocalStorage } from "node:async_hooks";
import { prisma } from "../../db/client";
import { runInDatabaseTransaction } from "../../db/requestSession";

interface RequiredCanonicalEventState {
  requiredTypes: Set<string>;
  publishedTypes: Set<string>;
  publishFailure?: unknown;
}

const requiredCanonicalEvents = new AsyncLocalStorage<RequiredCanonicalEventState>();

export async function runWithRequiredCanonicalEvents<T>(
  requiredTypes: readonly string[],
  operation: () => Promise<T>
): Promise<T> {
  return runInDatabaseTransaction(prisma, async () => {
    const state: RequiredCanonicalEventState = {
      requiredTypes: new Set(requiredTypes),
      publishedTypes: new Set(),
    };

    return requiredCanonicalEvents.run(state, async () => {
      const result = await operation();

      if (state.publishFailure !== undefined) {
        throw state.publishFailure;
      }

      const missing = [...state.requiredTypes].filter((type) => !state.publishedTypes.has(type));
      if (missing.length > 0) {
        throw new Error(`[athena-events] required canonical event was not persisted: ${missing.join(", ")}`);
      }

      return result;
    });
  });
}

export function recordCanonicalEventPublished(type: string): void {
  const state = requiredCanonicalEvents.getStore();
  if (state?.requiredTypes.has(type)) {
    state.publishedTypes.add(type);
  }
}

export function recordCanonicalEventPublishFailure(type: string, error: unknown): void {
  const state = requiredCanonicalEvents.getStore();
  if (state?.requiredTypes.has(type) && state.publishFailure === undefined) {
    state.publishFailure = error;
  }
}
