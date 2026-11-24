// Keep the MCP Firefox profile's egress CA current.
//
// The Hatch sandbox egress CA rotates within minutes. Firefox only trusts a
// CA that is in its persistent profile's NSS database, so a profile synced
// once at setup time goes stale and every HTTPS navigation fails with
// SEC_ERROR_UNKNOWN. `tests/playwright/mcp-server.mjs` runs this helper
// before every MCP launch (delete-then-add when the fingerprint differs), so
// the browser always starts with the live CA and full TLS validation.
//
// Usage:
//   node tests/playwright/sync-egress-ca.mjs           # re-sync when stale
//   node tests/playwright/sync-egress-ca.mjs --check   # report only
//
// Environment (all optional; paths come from the environment only, never
// hardcoded profile locations):
//   TRADEOS_MCP_FIREFOX_USER_DATA_DIR  persistent Firefox profile directory
//   TRADEOS_EGRESS_CA_PATH             live egress CA PEM (default below)
//   TRADEOS_EGRESS_CA_NICKNAME         profile nickname (default below)
//
// Exit codes: 0 current / synced / skipped (not a sandbox, or no profile);
// 2 stale (only with --check); 1 hard failure. Nothing here reads or prints
// proxy settings or any credential.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const DEFAULT_CA_PATH = "/run/hatch/egress-tls/hatch-egress-ca.pem";
export const DEFAULT_NICKNAME = "Hatch Sandbox Egress CA";
export const PROFILE_ENV_VAR = "TRADEOS_MCP_FIREFOX_USER_DATA_DIR";
export const CA_PATH_ENV_VAR = "TRADEOS_EGRESS_CA_PATH";
export const CA_NICKNAME_ENV_VAR = "TRADEOS_EGRESS_CA_NICKNAME";

const defaultDeps = {
  run: (command, args, options) =>
    spawnSync(command, args, { encoding: "utf8", ...options }),
  exists: existsSync,
  readFile: (path) => readFileSync(path, "utf8"),
};

export function normalizeFingerprint(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function parseFingerprint(output) {
  const match = /SHA256 Fingerprint=([0-9A-Fa-f:]+)/i.exec(output ?? "");
  return match ? normalizeFingerprint(match[1]) : "";
}

function fingerprintFromPem(pem, deps) {
  const result = deps.run("openssl", ["x509", "-noout", "-fingerprint", "-sha256"], {
    input: pem,
  });
  if (result.error) {
    throw new Error(
      `sync-egress-ca: openssl is not available (${result.error.message})`,
    );
  }
  if (result.status !== 0) {
    throw new Error("sync-egress-ca: openssl could not read the certificate");
  }
  const fingerprint = parseFingerprint(result.stdout);
  if (!fingerprint) {
    throw new Error("sync-egress-ca: openssl returned no SHA256 fingerprint");
  }
  return fingerprint;
}

export function liveFingerprint(caPath, deps = defaultDeps) {
  let pem;
  try {
    pem = deps.readFile(caPath);
  } catch (error) {
    throw new Error(
      `sync-egress-ca: cannot read the egress CA file at ${caPath} (${error.message})`,
    );
  }
  return fingerprintFromPem(pem, deps);
}

export function profileFingerprint(profileDir, nickname, deps = defaultDeps) {
  const result = deps.run("certutil", [
    "-L",
    "-d",
    `sql:${profileDir}`,
    "-n",
    nickname,
    "-a",
  ]);
  if (result.error) {
    throw new Error(
      `sync-egress-ca: certutil (NSS tools) is not available (${result.error.message})`,
    );
  }
  if (result.status !== 0 || !result.stdout?.includes("-----BEGIN CERTIFICATE-----")) {
    return null;
  }
  return fingerprintFromPem(result.stdout, deps);
}

export function describeSyncTarget(env = {}) {
  return {
    caPath: env[CA_PATH_ENV_VAR] || DEFAULT_CA_PATH,
    profileDir: env[PROFILE_ENV_VAR] || "",
    nickname: env[CA_NICKNAME_ENV_VAR] || DEFAULT_NICKNAME,
  };
}

/** Compare the profile CA against the live egress CA without changing anything. */
export function checkEgressCa(env = {}, deps = defaultDeps) {
  if (process.platform === "win32") {
    return {
      state: "skipped",
      reason: "NSS certutil sync is Linux-only; skipping on Windows",
      liveFingerprint: "",
      profileFingerprint: "",
    };
  }
  const { caPath, profileDir, nickname } = describeSyncTarget(env);
  if (!deps.exists(caPath)) {
    return {
      state: "skipped",
      reason: `no egress CA file at ${caPath}; not a Hatch sandbox`,
      liveFingerprint: "",
      profileFingerprint: "",
    };
  }
  // Read the live CA even when there is no profile to compare against, so
  // --check still reports the fingerprint worth syncing to.
  const live = liveFingerprint(caPath, deps);
  if (!profileDir) {
    return {
      state: "skipped",
      reason: `${PROFILE_ENV_VAR} is not set; no persistent Firefox profile to sync`,
      liveFingerprint: live,
      profileFingerprint: "",
    };
  }
  const profile = profileFingerprint(profileDir, nickname, deps);
  if (profile && normalizeFingerprint(profile) === normalizeFingerprint(live)) {
    return {
      state: "current",
      liveFingerprint: live,
      profileFingerprint: profile,
      reason: "profile CA matches the live egress CA",
    };
  }
  return {
    state: "stale",
    liveFingerprint: live,
    profileFingerprint: profile ?? "",
    reason: profile
      ? "profile CA differs from the live egress CA"
      : `profile has no certificate named "${nickname}"`,
  };
}

/**
 * Re-sync the profile CA when it differs from the live egress CA.
 * Returns the check result for the current/skipped cases; throws with a
 * clear, actionable message on any hard failure.
 */
export function syncEgressCa(env = {}, deps = defaultDeps) {
  const { caPath, profileDir, nickname } = describeSyncTarget(env);
  // In sync mode, skip before reading the CA when no profile is
  // configured: reading the CA shells out to openssl, and when openssl is
  // unavailable the launcher would fail even though there is nothing to
  // sync (the launcher promises exit 0 without a profile). --check still
  // reports the live fingerprint through checkEgressCa.
  if (!profileDir) {
    return {
      state: "skipped",
      reason: `${PROFILE_ENV_VAR} is not set; no persistent Firefox profile to sync`,
      liveFingerprint: "",
      profileFingerprint: "",
    };
  }
  const checked = checkEgressCa(env, deps);
  if (checked.state !== "stale") return checked;
  if (checked.profileFingerprint) {
    // certutil -A refuses to replace an existing nickname, so delete first.
    deps.run("certutil", ["-D", "-d", `sql:${profileDir}`, "-n", nickname]);
  }
  const added = deps.run("certutil", [
    "-A",
    "-d",
    `sql:${profileDir}`,
    "-n",
    nickname,
    "-t",
    "CT,C,c",
    "-i",
    caPath,
  ]);
  if (added.error) {
    throw new Error(
      `sync-egress-ca: certutil (NSS tools) is not available (${added.error.message})`,
    );
  }
  if (added.status !== 0) {
    throw new Error(
      `sync-egress-ca: certutil could not add the egress CA to the Firefox profile at ${profileDir} (exit ${added.status}). Is the profile in use by a running Firefox?`,
    );
  }
  const after = profileFingerprint(profileDir, nickname, deps);
  // Re-read the live CA after the import: the CA rotates within minutes,
  // so the fingerprint recorded by the pre-import check can already be
  // stale. Comparing the profile against that value would report a
  // successful re-sync as a failure whenever the CA rotated mid-sync.
  const freshLive = liveFingerprint(caPath, deps);
  if (!after || normalizeFingerprint(after) !== normalizeFingerprint(freshLive)) {
    throw new Error(
      `sync-egress-ca: re-sync did not take effect; the profile CA still does not match ${caPath}. Re-run with --check to diagnose.`,
    );
  }
  return {
    state: "synced",
    liveFingerprint: freshLive,
    profileFingerprint: after,
    reason: "profile CA re-synced to the live egress CA",
  };
}

function printCheck(result) {
  console.log(`live egress CA: ${result.liveFingerprint || "(not found)"}`);
  console.log(`profile CA:     ${result.profileFingerprint || "(not found)"}`);
  if (result.state === "current") {
    console.log("MATCH: profile CA is current.");
  } else if (result.state === "stale") {
    console.log(
      `STALE: ${result.reason}. Run sync-egress-ca with no flags (or restart the MCP server) to re-sync.`,
    );
  } else {
    console.log(`SKIPPED: ${result.reason}.`);
  }
}

export function main(argv = process.argv.slice(2), env = process.env, deps = defaultDeps) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(
      "Usage: node tests/playwright/sync-egress-ca.mjs [--check]\n" +
        "  no flags  re-sync the MCP Firefox profile CA when it differs from the live egress CA\n" +
        "  --check   report profile-CA vs live-CA fingerprints without changing anything (exit 2 when stale)",
    );
    return 0;
  }
  try {
    if (argv.includes("--check")) {
      const result = checkEgressCa(env, deps);
      printCheck(result);
      return result.state === "stale" ? 2 : 0;
    }
    const result = syncEgressCa(env, deps);
    if (result.state === "current") {
      console.log(`sync-egress-ca: profile CA is current (${result.profileFingerprint}).`);
    } else if (result.state === "synced") {
      console.log(`sync-egress-ca: profile CA re-synced (${result.profileFingerprint}).`);
    } else {
      console.log(`sync-egress-ca: skipped (${result.reason}).`);
    }
    return 0;
  } catch (error) {
    console.error(`sync-egress-ca: ${error.message}`);
    console.error(
      "MCP browsing cannot trust the sandbox egress until this is fixed. " +
        "Check that the profile directory is not in use by a running Firefox, " +
        "that certutil/openssl are installed, and that the egress CA file exists.",
    );
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
