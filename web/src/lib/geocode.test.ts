import test from "node:test";
import assert from "node:assert/strict";
import { geocodeAddress } from "./geocode.ts";

const censusMatch = {
  result: {
    addressMatches: [
      {
        coordinates: { x: -87.413, y: 39.4665 },
        matchedAddress: "4050 S State Road 63, Terre Haute, IN 47802",
      },
    ],
  },
};

function stubFetch(handler: (url: string) => unknown) {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: unknown) => {
    const url = typeof input === "string" ? input : String((input as URL).toString());
    return Promise.resolve(handler(url));
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

test("geocodeAddress returns coordinates for a matched US street address", async (t) => {
  const restore = stubFetch((url) => {
    assert.match(url, /geocoding\.geo\.census\.gov/);
    assert.match(url, /4050/);
    return { ok: true, json: async () => censusMatch };
  });
  t.after(restore);
  const result = await geocodeAddress("4050 S State Road 63, Terre Haute, IN 47802", AbortSignal.timeout(5000));
  assert.deepEqual(result, { lat: 39.4665, lon: -87.413 });
});

test("geocodeAddress returns null when the address has no match", async (t) => {
  const restore = stubFetch(() => ({ ok: true, json: async () => ({ result: { addressMatches: [] } }) }));
  t.after(restore);
  const result = await geocodeAddress("Nowhere Road, Nowhere, IN", AbortSignal.timeout(5000));
  assert.equal(result, null);
});

test("geocodeAddress returns null on a non-OK geocoder response", async (t) => {
  const restore = stubFetch(() => ({ ok: false, status: 500, json: async () => ({}) }));
  t.after(restore);
  const result = await geocodeAddress("4050 S State Road 63, Terre Haute, IN 47802", AbortSignal.timeout(5000));
  assert.equal(result, null);
});

test("geocodeAddress returns null when the fetch itself fails", async (t) => {
  const original = globalThis.fetch;
  globalThis.fetch = (() => Promise.reject(new Error("network down"))) as typeof fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const result = await geocodeAddress("4050 S State Road 63, Terre Haute, IN 47802", AbortSignal.timeout(5000));
  assert.equal(result, null);
});
