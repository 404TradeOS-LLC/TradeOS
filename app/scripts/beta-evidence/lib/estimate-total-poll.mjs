// Poll the authoritative estimate detail until totalPrice lands on the
// expected value. Text waits cannot serve as a settle signal for priced
// totals: the Review section renders totalPrice earlier in DOM order than
// the Athena aside, and it is hidden while Price is active, so a
// getByText(...).first() visible-wait pins the hidden match and times out
// even after the save lands. Returns the matching detail, or the last-seen
// detail (or null if nothing was ever read) when the timeout expires; the
// caller asserts on the result so a timeout surfaces as a business
// assertion, not a locator timeout.
export async function waitForEstimateTotal(page, estimateId, expected, { timeoutMs = 60_000, intervalMs = 1000, maxConsecutiveFailures = 3 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  let consecutiveFailures = 0;
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
      consecutiveFailures = 0;
      if (Math.abs(Number(detail.totalPrice) - expected) < 0.005) return detail;
    } else {
      // The endpoint is dead or the estimate is gone: stop burning one
      // request per second against it for the full 60 s. A transient blip
      // still recovers (the counter resets on the next successful fetch),
      // and the caller asserts on the result, so an early return still
      // surfaces as a business assertion, not a silent pass.
      consecutiveFailures += 1;
      if (consecutiveFailures >= maxConsecutiveFailures) return last;
    }
    await page.waitForTimeout(intervalMs);
  }
  return last;
}
