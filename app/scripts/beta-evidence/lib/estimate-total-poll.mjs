// Poll the authoritative estimate detail until totalPrice lands on the
// expected value. Text waits cannot serve as a settle signal for priced
// totals: the Review section renders totalPrice earlier in DOM order than
// the Athena aside, and it is hidden while Price is active, so a
// getByText(...).first() visible-wait pins the hidden match and times out
// even after the save lands. Returns the matching detail, or the last-seen
// detail (or null if nothing was ever read) when the timeout expires; the
// caller asserts on the result so a timeout surfaces as a business
// assertion, not a locator timeout.
export async function waitForEstimateTotal(page, estimateId, expected, { timeoutMs = 60_000, intervalMs = 1000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    const detail = await page.evaluate(async (id) => {
      try {
        const response = await fetch(`/api/proxy/estimates/${id}`, { headers: { Accept: "application/json" } });
        if (!response.ok) return null;
        return await response.json();
      } catch {
        return null;
      }
    }, estimateId);
    if (detail) {
      last = detail;
      if (Math.abs(Number(detail.totalPrice) - expected) < 0.005) return detail;
    }
    await page.waitForTimeout(intervalMs);
  }
  return last;
}
