import { getAthenaFlags, isAthenaKernelEnabled } from "../modules/athena-kernel/flags";

describe("athena kernel feature flags", () => {
  it("ships dark by default: kernel disabled, provider disabled, draft responses disabled", () => {
    const flags = getAthenaFlags({} as NodeJS.ProcessEnv);
    expect(flags.kernelEnabled).toBe(false);
    expect(flags.providerMode).toBe("disabled");
    expect(flags.draftResponsesEnabled).toBe(false);
  });

  it("defaults telemetry and cost tracking to enabled (metadata-only, not a business behavior gate)", () => {
    const flags = getAthenaFlags({} as NodeJS.ProcessEnv);
    expect(flags.telemetryEnabled).toBe(true);
    expect(flags.costTrackingEnabled).toBe(true);
  });

  it("only the literal string 'true' enables a boolean flag", () => {
    expect(getAthenaFlags({ ATHENA_KERNEL_ENABLED: "1" } as NodeJS.ProcessEnv).kernelEnabled).toBe(false);
    expect(getAthenaFlags({ ATHENA_KERNEL_ENABLED: "TRUE" } as NodeJS.ProcessEnv).kernelEnabled).toBe(true);
    expect(getAthenaFlags({ ATHENA_KERNEL_ENABLED: "true" } as NodeJS.ProcessEnv).kernelEnabled).toBe(true);
  });

  it("only 'fake' selects the fake provider; every other value stays disabled", () => {
    expect(getAthenaFlags({ ATHENA_PROVIDER_MODE: "fake" } as NodeJS.ProcessEnv).providerMode).toBe("fake");
    expect(getAthenaFlags({ ATHENA_PROVIDER_MODE: "production" } as NodeJS.ProcessEnv).providerMode).toBe("disabled");
    expect(getAthenaFlags({ ATHENA_PROVIDER_MODE: "" } as NodeJS.ProcessEnv).providerMode).toBe("disabled");
  });

  it("isAthenaKernelEnabled mirrors getAthenaFlags().kernelEnabled", () => {
    expect(isAthenaKernelEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(isAthenaKernelEnabled({ ATHENA_KERNEL_ENABLED: "true" } as NodeJS.ProcessEnv)).toBe(true);
  });
});
