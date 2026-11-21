import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkEgressCa,
  main,
  normalizeFingerprint,
  parseFingerprint,
  syncEgressCa,
} from "./sync-egress-ca.mjs";

const LIVE_FP = "7D:C1:DA:D3:29:0D:37:85:DD:44:3C:EB:45:62:C5:E0:AB:75:FA:D5:B6:33:2E:A8:33:94:FF:13:EC:53:36:91";
const STALE_FP = "AE:25:5F:18:02:2D:29:F6:84:74:78:FF:93:6D:47:C5:FC:63:10:AA:F9:41:67:B4:1D:BE:88:62:D3:43:11:D2";
const ROTATED_FP = "3A:7F:9C:1B:44:2E:88:0D:5A:6B:1C:2D:3E:4F:50:61:72:83:94:A5:B6:C7:D8:E9:F0:01:12:23:34:45:56:67";
const CA_PATH = "/run/hatch/egress-tls/hatch-egress-ca.pem";
const PROFILE = "/home/hatch/.config/tradeos-mcp/firefox-profile";

const env = {
  TRADEOS_EGRESS_CA_PATH: CA_PATH,
  TRADEOS_MCP_FIREFOX_USER_DATA_DIR: PROFILE,
};

// Fake certutil/openssl: the profile holds one nickname whose PEM maps to a
// fingerprint; the live CA file maps to LIVE_FP (or ROTATED_FP after a
// simulated rotation). `rotateOnDelete` moves the live CA to ROTATED_FP
// when the old profile certificate is deleted, i.e. between the pre-import
// check and the import.
function makeDeps({ profilePem = null, addFails = false, noCertutil = false, noOpenssl = false, rotateOnDelete = false } = {}) {
  let profile = profilePem; // null = nickname absent; "PROFILE-PEM" = stale cert
  let livePem = "LIVE-PEM";
  const calls = [];
  const deps = {
    calls,
    exists: (path) => path === CA_PATH,
    readFile: (path) => {
      if (path !== CA_PATH) throw new Error(`ENOENT: no such file ${path}`);
      return livePem;
    },
    run: (command, args, options) => {
      calls.push([command, ...args]);
      if (noOpenssl && command === "openssl") {
        return { error: new Error("spawn openssl ENOENT"), status: null, stdout: "", stderr: "" };
      }
      if (noCertutil && command === "certutil") {
        return { error: new Error("spawn certutil ENOENT"), status: null, stdout: "", stderr: "" };
      }
      if (command === "openssl") {
        const input = options?.input ?? "";
        const fp = input.includes("ROTATED-PEM")
          ? ROTATED_FP
          : input.includes("LIVE-PEM")
            ? LIVE_FP
            : input.includes("PROFILE-PEM")
              ? STALE_FP
              : "";
        return { status: fp ? 0 : 1, stdout: `SHA256 Fingerprint=${fp}\n`, stderr: "" };
      }
      if (command === "certutil" && args[0] === "-L") {
        if (!profile) return { status: 1, stdout: "", stderr: "not found" };
        return {
          status: 0,
          stdout: `-----BEGIN CERTIFICATE-----\n${profile}\n-----END CERTIFICATE-----\n`,
          stderr: "",
        };
      }
      if (command === "certutil" && args[0] === "-D") {
        profile = null;
        if (rotateOnDelete) livePem = "ROTATED-PEM";
        return { status: 0, stdout: "", stderr: "" };
      }
      if (command === "certutil" && args[0] === "-A") {
        if (addFails) return { status: 1, stdout: "", stderr: "add failed" };
        profile = livePem;
        return { status: 0, stdout: "", stderr: "" };
      }
      return { status: 1, stdout: "", stderr: "unexpected call" };
    },
  };
  return deps;
}

test("parseFingerprint reads openssl output and normalizes case", () => {
  assert.equal(
    parseFingerprint(
      "sha256 Fingerprint=7d:c1:da:d3:29:0d:37:85:dd:44:3c:eb:45:62:c5:e0:ab:75:fa:d5:b6:33:2e:a8:33:94:ff:13:ec:53:36:91\n",
    ),
    LIVE_FP,
  );
  assert.equal(parseFingerprint("garbage"), "");
  assert.equal(normalizeFingerprint("  ab:cd "), "AB:CD");
});

test("current profile is left alone (no delete/add)", () => {
  const deps = makeDeps({ profilePem: "LIVE-PEM" });
  const checked = checkEgressCa(env, deps);
  assert.equal(checked.state, "current");
  assert.equal(checked.profileFingerprint, LIVE_FP);
  const synced = syncEgressCa(env, deps);
  assert.equal(synced.state, "current");
  assert.equal(deps.calls.filter(([c, op]) => c === "certutil" && (op === "-D" || op === "-A")).length, 0);
});

test("stale profile is re-synced with delete-then-add", () => {
  const deps = makeDeps({ profilePem: "PROFILE-PEM" });
  const checked = checkEgressCa(env, deps);
  assert.equal(checked.state, "stale");
  assert.equal(checked.profileFingerprint, STALE_FP);
  assert.equal(checked.liveFingerprint, LIVE_FP);
  const callsBeforeSync = deps.calls.length;
  const synced = syncEgressCa(env, deps);
  assert.equal(synced.state, "synced");
  assert.equal(synced.profileFingerprint, LIVE_FP);
  const ops = deps.calls.slice(callsBeforeSync).filter(([c]) => c === "certutil").map(([, op]) => op);
  assert.deepEqual(ops, ["-L", "-D", "-A", "-L"]);
});

test("missing profile certificate adds without deleting", () => {
  const deps = makeDeps({ profilePem: null });
  const checked = checkEgressCa(env, deps);
  assert.equal(checked.state, "stale");
  assert.equal(checked.profileFingerprint, "");
  const callsBeforeSync = deps.calls.length;
  const synced = syncEgressCa(env, deps);
  assert.equal(synced.state, "synced");
  const ops = deps.calls.slice(callsBeforeSync).filter(([c]) => c === "certutil").map(([, op]) => op);
  assert.deepEqual(ops, ["-L", "-A", "-L"]);
});

test("skipped when the egress CA file is absent (not a sandbox)", () => {
  const deps = makeDeps();
  deps.exists = () => false;
  assert.equal(checkEgressCa(env, deps).state, "skipped");
  assert.equal(syncEgressCa(env, deps).state, "skipped");
});

test("skipped when no profile directory is configured (live CA still reported)", () => {
  const deps = makeDeps();
  const noProfile = { TRADEOS_EGRESS_CA_PATH: CA_PATH };
  const checked = checkEgressCa(noProfile, deps);
  assert.equal(checked.state, "skipped");
  assert.equal(checked.liveFingerprint, LIVE_FP);
  assert.equal(syncEgressCa(noProfile, deps).state, "skipped");
});

test("sync mode skips before reading the CA when no profile is configured (openssl absent)", () => {
  // The launcher promises exit 0 without a configured profile, but reading
  // the CA shells out to openssl — with openssl unavailable the old code
  // failed the launch even though there was nothing to sync.
  const deps = makeDeps({ noOpenssl: true });
  const noProfile = { TRADEOS_EGRESS_CA_PATH: CA_PATH };
  const synced = syncEgressCa(noProfile, deps);
  assert.equal(synced.state, "skipped");
  assert.equal(deps.calls.filter(([c]) => c === "openssl").length, 0);
});

test("sync verifies against the live CA re-read after import (rotation mid-sync)", () => {
  // The CA rotates within minutes: it can change between the pre-import
  // check and the import. The imported certificate is the current one, so
  // the post-import check must compare against a freshly read live
  // fingerprint, not the one recorded before the import.
  const deps = makeDeps({ profilePem: "PROFILE-PEM", rotateOnDelete: true });
  const synced = syncEgressCa(env, deps);
  assert.equal(synced.state, "synced");
  assert.equal(synced.liveFingerprint, ROTATED_FP);
  assert.equal(synced.profileFingerprint, ROTATED_FP);
});

test("failed add throws a clear, actionable error", () => {
  const deps = makeDeps({ profilePem: "PROFILE-PEM", addFails: true });
  assert.throws(
    () => syncEgressCa(env, deps),
    /certutil could not add the egress CA to the Firefox profile/,
  );
});

test("missing certutil throws instead of silently passing", () => {
  const deps = makeDeps({ noCertutil: true });
  assert.throws(() => checkEgressCa(env, deps), /certutil \(NSS tools\) is not available/);
});

test("main --check exits 2 when stale and 0 when current", () => {
  const staleDeps = makeDeps({ profilePem: "PROFILE-PEM" });
  const logs = [];
  const origLog = console.log;
  const origError = console.error;
  console.log = (...args) => logs.push(args.join(" "));
  console.error = (...args) => logs.push(args.join(" "));
  try {
    assert.equal(main(["--check"], env, staleDeps), 2);
    assert.match(logs.join("\n"), /STALE/);
    assert.match(logs.join("\n"), new RegExp(LIVE_FP));
    assert.match(logs.join("\n"), new RegExp(STALE_FP));
    logs.length = 0;
    const currentDeps = makeDeps({ profilePem: "LIVE-PEM" });
    assert.equal(main(["--check"], env, currentDeps), 0);
    assert.match(logs.join("\n"), /MATCH/);
  } finally {
    console.log = origLog;
    console.error = origError;
  }
});
