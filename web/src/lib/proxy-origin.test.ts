import assert from "node:assert/strict";
import test from "node:test";
import { shouldRejectProxyMutation } from "./proxy-origin";

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

test("does not require an Origin header for safe proxy reads", () => {
  assert.equal(shouldRejectProxyMutation("GET", requestUrl, null), false);
  assert.equal(shouldRejectProxyMutation("HEAD", requestUrl, null), false);
  assert.equal(shouldRejectProxyMutation("OPTIONS", requestUrl, null), false);
});
