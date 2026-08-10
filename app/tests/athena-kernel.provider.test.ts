import { AthenaKernelError } from "../modules/athena-kernel/errors";
import { DisabledAthenaProvider, FakeAthenaProvider, resolveAthenaProvider } from "../modules/athena-kernel/provider";

describe("athena kernel provider adapter", () => {
  it("resolves the fake provider only when ATHENA_PROVIDER_MODE=fake", () => {
    expect(resolveAthenaProvider({ ATHENA_PROVIDER_MODE: "fake" } as NodeJS.ProcessEnv)).toBeInstanceOf(FakeAthenaProvider);
    expect(resolveAthenaProvider({} as NodeJS.ProcessEnv)).toBeInstanceOf(DisabledAthenaProvider);
    expect(resolveAthenaProvider({ ATHENA_PROVIDER_MODE: "production" } as NodeJS.ProcessEnv)).toBeInstanceOf(DisabledAthenaProvider);
  });

  it("the fake provider returns a deterministic draft with no fabricated token/cost usage", async () => {
    const provider = new FakeAthenaProvider();
    const controller = new AbortController();
    const result = await provider.generateDraft({ message: "hello", signal: controller.signal, deadline: new Date(Date.now() + 5_000) });
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.provider).toBe("fake");
    expect(result.inputTokens).toBeUndefined();
    expect(result.outputTokens).toBeUndefined();
    expect(result.estimatedUsd).toBeUndefined();
  });

  it("the fake provider refuses to respond once its signal is aborted, typed as a cancellation - not a generic/provider failure", async () => {
    const provider = new FakeAthenaProvider();
    const controller = new AbortController();
    controller.abort();
    // Category/code/retryable matter here, not just "some AthenaKernelError":
    // the kernel service (service.ts) relies on this being distinguishable
    // from an ordinary provider failure so it can remap provider-observed
    // cancellation back to the kernel's own cancellation reason instead of
    // letting it fall through to a generic failed result.
    await expect(provider.generateDraft({ message: "hello", signal: controller.signal, deadline: new Date(Date.now() + 5_000) })).rejects.toMatchObject({
      code: "athena_cancelled",
      category: "timeout",
      retryable: false,
    });
    await expect(provider.generateDraft({ message: "hello", signal: controller.signal, deadline: new Date(Date.now() + 5_000) })).rejects.toBeInstanceOf(AthenaKernelError);
  });

  it("the fake provider fails closed once its deadline has already passed", async () => {
    const provider = new FakeAthenaProvider();
    const controller = new AbortController();
    await expect(provider.generateDraft({ message: "hello", signal: controller.signal, deadline: new Date(Date.now() - 1) })).rejects.toBeInstanceOf(AthenaKernelError);
  });

  it("the disabled provider always fails closed, never reaching a real model", async () => {
    const provider = new DisabledAthenaProvider();
    const controller = new AbortController();
    await expect(provider.generateDraft()).rejects.toMatchObject({ code: "athena_provider_disabled" });
    void controller;
  });
});
