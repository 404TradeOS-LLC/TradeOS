import { AthenaKernelError } from "../modules/athena-kernel/errors";
import { GEMINI_DEFAULT_MODEL, GoogleGeminiAthenaProvider } from "../modules/athena-kernel/provider";
import type { AthenaAIContext } from "../modules/athena-kernel/types";

// Deliberately fake key material: the adapter must never echo a key into an
// error, log, or telemetry field, so every assertion below uses this value.
const FAKE_KEY = "test-gemini-key-123";

function makeContext(overrides: Partial<AthenaAIContext> = {}): AthenaAIContext {
  return {
    version: "1.0.0",
    request: {
      requestId: "req-1",
      traceId: "trace-1",
      executionId: "exec-1",
      requestSource: "test",
      receivedAt: new Date().toISOString(),
      interaction: { channel: "text", platform: "web", viewportClass: "regular", connectivity: "online" },
    },
    organization: { orgId: "org-123" },
    user: { userId: "user-123", role: "owner" },
    permissions: { role: "owner", permissions: ["crm.read", "estimates.write"] },
    selectedScope: { jobId: "job-456", page: "/dashboard" },
    budget: { maxBytes: 131072, maxEstimatedTokens: 32768, maxProviderCount: 4 },
    telemetry: { traceId: "trace-1", executionId: "exec-1" },
    ...overrides,
  };
}

function geminiOkResponse(payload: unknown) {
  return { ok: true, status: 200, json: async () => payload } as unknown as Response;
}

function geminiErrorResponse(status: number) {
  return { ok: false, status, json: async () => ({ error: { message: "provider-side failure" } }) } as unknown as Response;
}

function successPayload(overrides: Record<string, unknown> = {}) {
  return {
    candidates: [{ content: { parts: [{ text: "Here is a draft answer." }] }, finishReason: "STOP" }],
    usageMetadata: { promptTokenCount: 2900, candidatesTokenCount: 300, thoughtsTokenCount: 50 },
    modelVersion: "gemini-3.5-flash-lite-001",
    ...overrides,
  };
}

describe("GoogleGeminiAthenaProvider", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function provider(env: Record<string, string | undefined> = {}) {
    return new GoogleGeminiAthenaProvider({ GEMINI_API_KEY: FAKE_KEY, ...env } as NodeJS.ProcessEnv);
  }

  it("calls generateContent with the key in a header (never a query parameter) and maps usage to tokens and cost", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    global.fetch = jest.fn(async (url: string, init: RequestInit) => {
      capturedUrl = url;
      capturedInit = init;
      return geminiOkResponse(successPayload());
    }) as unknown as typeof fetch;

    const result = await provider().generateDraft({
      message: "What is on this job today?",
      context: makeContext(),
      signal: new AbortController().signal,
      deadline: new Date(Date.now() + 5_000),
    });

    expect(result.text).toBe("Here is a draft answer.");
    expect(result.provider).toBe("google");
    expect(result.model).toBe(GEMINI_DEFAULT_MODEL);
    expect(result.providerVersion).toBe("gemini-3.5-flash-lite-001");
    expect(result.inputTokens).toBe(2900);
    expect(result.outputTokens).toBe(350);
    // 2900 * $0.30/1M + 350 * $2.50/1M = $0.00087 + $0.000875.
    expect(result.estimatedUsd).toBeCloseTo(0.001745, 9);
    expect(capturedUrl).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_DEFAULT_MODEL}:generateContent`);
    expect(capturedUrl).not.toContain(FAKE_KEY);
    expect(capturedInit?.headers).toMatchObject({ "x-goog-api-key": FAKE_KEY, "Content-Type": "application/json" });
    const body = JSON.parse(String(capturedInit?.body));
    expect(body.generationConfig).toEqual({ temperature: 0.3, maxOutputTokens: 1024, thinkingConfig: { thinkingLevel: "LOW" } });
    expect(body.system_instruction.parts[0].text).toContain("draft-only");
    const userText = body.contents[0].parts[0].text as string;
    expect(userText).toContain("Role: owner");
    expect(userText).toContain("Scope job: job-456");
    expect(userText).toContain("Scope page: /dashboard");
    expect(userText).toContain("Channel: text");
    expect(userText).toContain("What is on this job today?");
    // Minimal context only: no org/user ids, no permission list, no request ids.
    expect(userText).not.toContain("org-123");
    expect(userText).not.toContain("user-123");
    expect(userText).not.toContain("crm.read");
    expect(userText).not.toContain("req-1");
  });

  it("uses ATHENA_GEMINI_MODEL when set and leaves token fields undefined without usageMetadata", async () => {
    let capturedUrl = "";
    global.fetch = jest.fn(async (url: string) => {
      capturedUrl = url;
      return geminiOkResponse(successPayload({ usageMetadata: undefined }));
    }) as unknown as typeof fetch;

    const result = await provider({ ATHENA_GEMINI_MODEL: "gemini-3.5-flash" }).generateDraft({
      message: "hello",
      signal: new AbortController().signal,
      deadline: new Date(Date.now() + 5_000),
    });
    expect(capturedUrl).toContain("/v1beta/models/gemini-3.5-flash:generateContent");
    expect(result.model).toBe("gemini-3.5-flash");
    expect(result.inputTokens).toBeUndefined();
    expect(result.outputTokens).toBeUndefined();
    expect(result.estimatedUsd).toBeUndefined();
  });

  it("treats MAX_TOKENS with text as a truncated success", async () => {
    global.fetch = jest.fn(async () =>
      geminiOkResponse(successPayload({ candidates: [{ content: { parts: [{ text: "Partial." }] }, finishReason: "MAX_TOKENS" }] })),
    ) as unknown as typeof fetch;
    const result = await provider().generateDraft({
      message: "hello",
      signal: new AbortController().signal,
      deadline: new Date(Date.now() + 5_000),
    });
    expect(result.text).toBe("Partial.");
  });

  it.each([429, 500, 503])("maps HTTP %s to a retryable provider error", async (status) => {
    global.fetch = jest.fn(async () => geminiErrorResponse(status)) as unknown as typeof fetch;
    await expect(
      provider().generateDraft({ message: "hello", signal: new AbortController().signal, deadline: new Date(Date.now() + 5_000) }),
    ).rejects.toMatchObject({ code: "athena_provider_unavailable", category: "provider", retryable: true });
  });

  it("maps a network failure to a retryable provider error without leaking the key", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    let caught: unknown;
    try {
      await provider().generateDraft({ message: "hello", signal: new AbortController().signal, deadline: new Date(Date.now() + 5_000) });
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({ code: "athena_provider_unavailable", category: "provider", retryable: true });
    expect(JSON.stringify(caught)).not.toContain(FAKE_KEY);
  });

  it.each([401, 403])("maps HTTP %s to a non-retryable provider auth error", async (status) => {
    global.fetch = jest.fn(async () => geminiErrorResponse(status)) as unknown as typeof fetch;
    let caught: unknown;
    try {
      await provider().generateDraft({ message: "hello", signal: new AbortController().signal, deadline: new Date(Date.now() + 5_000) });
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({ code: "athena_provider_auth_failed", category: "provider", retryable: false });
    expect(caught).toBeInstanceOf(AthenaKernelError);
    expect(JSON.stringify(caught)).not.toContain(FAKE_KEY);
  });

  it("maps HTTP 400 to a service error", async () => {
    global.fetch = jest.fn(async () => geminiErrorResponse(400)) as unknown as typeof fetch;
    await expect(
      provider().generateDraft({ message: "hello", signal: new AbortController().signal, deadline: new Date(Date.now() + 5_000) }),
    ).rejects.toMatchObject({ code: "athena_provider_bad_request", category: "service", retryable: false });
  });

  it("maps empty, safety-blocked, and prompt-blocked responses to a service error", async () => {
    const cases = [
      successPayload({ candidates: [] }),
      successPayload({ candidates: [{ content: { parts: [{ text: "Blocked text." }] }, finishReason: "SAFETY" }] }),
      successPayload({ candidates: [{ content: { parts: [{ text: "" }] }, finishReason: "STOP" }] }),
      successPayload({ promptFeedback: { blockReason: "SAFETY" } }),
    ];
    for (const payload of cases) {
      global.fetch = jest.fn(async () => geminiOkResponse(payload)) as unknown as typeof fetch;
      await expect(
        provider().generateDraft({ message: "hello", signal: new AbortController().signal, deadline: new Date(Date.now() + 5_000) }),
      ).rejects.toMatchObject({ code: "athena_provider_empty_response", category: "service", retryable: false });
    }
  });

  it("carries chargeable usage on a safety-blocked response so the spend cap can count it", async () => {
    // successPayload carries usageMetadata (2900 prompt / 300 candidates /
    // 50 thoughts tokens); a SAFETY finish still consumed those tokens.
    global.fetch = jest.fn(async () =>
      geminiOkResponse(successPayload({ candidates: [{ content: { parts: [{ text: "Blocked text." }] }, finishReason: "SAFETY" }] }))
    ) as unknown as typeof fetch;
    let caught: unknown;
    try {
      await provider().generateDraft({ message: "hello", signal: new AbortController().signal, deadline: new Date(Date.now() + 5_000) });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AthenaKernelError);
    expect(caught).toMatchObject({ code: "athena_provider_empty_response", inputTokens: 2900, outputTokens: 350, model: GEMINI_DEFAULT_MODEL });
    // (2900 x $0.30 + 350 x $2.50) / 1M = $0.001745.
    expect((caught as AthenaKernelError).estimatedUsd).toBeCloseTo(0.001745);
  });

  it("refuses to respond once its signal is aborted, typed as a cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(
      provider().generateDraft({ message: "hello", signal: controller.signal, deadline: new Date(Date.now() + 5_000) }),
    ).rejects.toMatchObject({ code: "athena_cancelled", category: "timeout", retryable: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lets a mid-call abort propagate as an abort error instead of converting it to a provider error", async () => {
    global.fetch = jest.fn(async () => {
      throw new DOMException("The operation was aborted.", "AbortError");
    }) as unknown as typeof fetch;
    let caught: unknown;
    try {
      await provider().generateDraft({ message: "hello", signal: new AbortController().signal, deadline: new Date(Date.now() + 5_000) });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DOMException);
    expect(caught).not.toBeInstanceOf(AthenaKernelError);
    expect((caught as DOMException).name).toBe("AbortError");
  });

  it("aborts the fetch at the provider deadline and surfaces a non-retryable provider timeout", async () => {
    // A hung socket that never settles: the fetch-level cap must end the
    // call at the deadline instead of holding it until the platform limit,
    // and the failure must be typed as a provider timeout (terminal), not
    // an unknown error and not a retryable provider error.
    let capturedSignal: AbortSignal | undefined;
    global.fetch = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise<never>((_resolve, reject) => {
          capturedSignal = init.signal ?? undefined;
          capturedSignal?.addEventListener(
            "abort",
            () => reject(new DOMException("The operation was aborted.", "AbortError")),
            { once: true },
          );
        }),
    ) as unknown as typeof fetch;
    const inputSignal = new AbortController().signal;
    let caught: unknown;
    try {
      await provider().generateDraft({ message: "hello", signal: inputSignal, deadline: new Date(Date.now() + 20) });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AthenaKernelError);
    expect(caught).toMatchObject({ code: "athena_provider_timeout", category: "timeout", retryable: false });
    // The fetch runs on a combined signal (kernel signal + fetch-level
    // timeout), not the bare kernel signal, so the socket is bounded even
    // if the kernel race never fires.
    expect(capturedSignal).toBeDefined();
    expect(capturedSignal).not.toBe(inputSignal);
    expect(inputSignal.aborted).toBe(false);
  }, 10_000);

  it("truncates an over-budget context block but never drops scope ids", async () => {
    let capturedBody = "";
    global.fetch = jest.fn(async (_url: string, init: RequestInit) => {
      capturedBody = String(init.body);
      return geminiOkResponse(successPayload());
    }) as unknown as typeof fetch;
    const result = await provider().generateDraft({
      message: "hello",
      context: makeContext({ selectedScope: { jobId: "job-456", page: `/${"p".repeat(150_000)}` } }),
      signal: new AbortController().signal,
      deadline: new Date(Date.now() + 5_000),
    });
    expect(result.text).toBe("Here is a draft answer.");
    expect(capturedBody).toContain("Scope job: job-456");
    expect(capturedBody).not.toContain("p".repeat(150_000));
  });

  it("fails closed instead of answering when truncation would remove a scope id", async () => {
    const fetchMock = jest.fn(async () => geminiOkResponse(successPayload()));
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(
      provider().generateDraft({
        message: "hello",
        context: makeContext({ selectedScope: { jobId: `job-${"j".repeat(200_000)}` } }),
        signal: new AbortController().signal,
        deadline: new Date(Date.now() + 5_000),
      }),
    ).rejects.toMatchObject({ code: "athena_provider_context_too_large", category: "service", retryable: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed as an auth error when constructed without a key, without calling the network", async () => {
    const fetchMock = jest.fn(async () => geminiOkResponse(successPayload()));
    global.fetch = fetchMock as unknown as typeof fetch;
    const noKey = new GoogleGeminiAthenaProvider({} as NodeJS.ProcessEnv);
    await expect(
      noKey.generateDraft({ message: "hello", signal: new AbortController().signal, deadline: new Date(Date.now() + 5_000) }),
    ).rejects.toMatchObject({ code: "athena_provider_auth_failed", category: "provider", retryable: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
