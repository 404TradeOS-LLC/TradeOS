import assert from "node:assert/strict";
import test from "node:test";
import { shouldRejectProxyMutation } from "./proxy-origin.ts";

const requestUrl = "https://app.404tradeos.com/api/proxy/projects/123";

test("allows same-origin authenticated proxy mutations", () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.equal(shouldRejectProxyMutation(method, requestUrl, "https://app.404tradeos.com"), false);
  }
});

test("rejects same-site sibling origins for authenticated proxy mutations", () => {
  assert.equal(
    shouldRejectProxyMutation("POST", requestUrl, "https://evil.404tradeos.com"),
    true,
  );
});

test("rejects missing or malformed origins for authenticated proxy mutations", () => {
  assert.equal(shouldRejectProxyMutation("PATCH", requestUrl, null), true);
  assert.equal(shouldRejectProxyMutation("DELETE", requestUrl, "not a url"), true);
});

test("allows a missing Origin when Sec-Fetch-Site proves a same-origin navigation", () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.equal(shouldRejectProxyMutation(method, requestUrl, null, "same-origin"), false);
  }
});

test("rejects a missing Origin without a same-origin Sec-Fetch-Site", () => {
  assert.equal(shouldRejectProxyMutation("POST", requestUrl, null, null), true);
  assert.equal(shouldRejectProxyMutation("POST", requestUrl, null, "cross-site"), true);
  assert.equal(shouldRejectProxyMutation("POST", requestUrl, null, "same-site"), true);
  assert.equal(shouldRejectProxyMutation("POST", requestUrl, null, "none"), true);
  assert.equal(shouldRejectProxyMutation("POST", requestUrl, "", "same-origin"), false);
});

test("allows a missing Origin when a same-site cookie proves the request origin", () => {
  // Regression: the staging confirm-form POST arrives with neither Origin nor
  // Sec-Fetch-Site (both stripped on the browser/proxy path), so the header
  // proofs #1088 added can never fire for it. The pending-access cookie is
  // httpOnly, SameSite=strict, path-scoped, and cleared on redeem, so its
  // presence on the request proves same-site even when headers are stripped.
  assert.equal(shouldRejectProxyMutation("POST", requestUrl, null, null, true), false);
  assert.equal(shouldRejectProxyMutation("POST", requestUrl, null, "cross-site", true), false);
});

test("rejects a missing Origin with neither Sec-Fetch-Site nor a same-site cookie", () => {
  assert.equal(shouldRejectProxyMutation("POST", requestUrl, null, null, false), true);
  assert.equal(shouldRejectProxyMutation("POST", requestUrl, null, "same-site", false), true);
});

test("a same-site cookie does not override a present Origin", () => {
  assert.equal(shouldRejectProxyMutation("POST", requestUrl, "https://evil.404tradeos.com", "same-origin", true), true);
  assert.equal(shouldRejectProxyMutation("POST", requestUrl, "https://app.404tradeos.com", "cross-site", true), false);
  assert.equal(shouldRejectProxyMutation("DELETE", requestUrl, "not a url", null, true), true);
});

test("treats the serialized opaque origin \"null\" as a missing Origin", () => {
  // Regression: the confirm flow declares Referrer-Policy: no-referrer, so
  // Chrome serializes the confirm-form POST's Origin header as the literal
  // string "null" (proven in a real Chromium A/B: no-referrer -> "null",
  // without it -> the page origin). "null" carries no origin information,
  // so it must fall through to the Sec-Fetch-Site / cookie proofs instead of
  // being treated as an authoritative present Origin (new URL("null") throws
  // and the guard rejected before the proofs were ever consulted).
  assert.equal(shouldRejectProxyMutation("POST", requestUrl, "null", "same-origin"), false);
  assert.equal(shouldRejectProxyMutation("POST", requestUrl, "null", null, true), false);
  assert.equal(shouldRejectProxyMutation("POST", requestUrl, "null", "cross-site", true), false);
  assert.equal(shouldRejectProxyMutation("POST", requestUrl, "null", null, false), true);
  assert.equal(shouldRejectProxyMutation("POST", requestUrl, "null", "cross-site", false), true);
  assert.equal(shouldRejectProxyMutation("POST", requestUrl, "null", "same-site", false), true);
});

test("a present Origin stays authoritative over Sec-Fetch-Site", () => {
  assert.equal(shouldRejectProxyMutation("POST", requestUrl, "https://app.404tradeos.com", "cross-site"), false);
  assert.equal(shouldRejectProxyMutation("POST", requestUrl, "https://evil.404tradeos.com", "same-origin"), true);
  assert.equal(shouldRejectProxyMutation("DELETE", requestUrl, "not a url", "same-origin"), true);
});

test("does not require an Origin header for safe proxy reads", () => {
  assert.equal(shouldRejectProxyMutation("GET", requestUrl, null), false);
  assert.equal(shouldRejectProxyMutation("HEAD", requestUrl, null), false);
  assert.equal(shouldRejectProxyMutation("OPTIONS", requestUrl, null), false);
});
