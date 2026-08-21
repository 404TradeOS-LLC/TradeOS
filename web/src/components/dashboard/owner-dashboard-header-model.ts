export interface ReviewQueueCounts {
  estimates: number;
  proposals: number;
  invoices: number;
  starts: number;
}

export interface ReviewQueueMetric {
  key: keyof ReviewQueueCounts;
  label: string;
  value: number;
}

const METRIC_LABELS: Record<keyof ReviewQueueCounts, { singular: string; plural: string }> = {
  estimates: { singular: "estimate", plural: "estimates" },
  proposals: { singular: "proposal", plural: "proposals" },
  invoices: { singular: "invoice", plural: "invoices" },
  starts: { singular: "ready to start", plural: "ready to start" },
};

/** Drops zero-count queues so the hero only shows metrics that are actually true right now. */
export function buildReviewQueueMetrics(reviewQueue: ReviewQueueCounts | undefined): ReviewQueueMetric[] {
  if (!reviewQueue) return [];

  return (Object.keys(METRIC_LABELS) as (keyof ReviewQueueCounts)[])
    .map((key) => {
      const value = reviewQueue[key];
      const labels = METRIC_LABELS[key];
      return { key, value, label: value === 1 ? labels.singular : labels.plural };
    })
    .filter((metric) => metric.value > 0);
}

/** Returns the owner-dashboard greeting for the supplied local hour. */
export function greetingForHour(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** The hours at which greetingForHour's return value changes. */
const GREETING_BOUNDARY_HOURS = [0, 5, 12, 18];

/** The next moment after `now` at which the greeting changes, so a mounted dashboard can refresh it live. */
export function getNextGreetingBoundary(now: Date): Date {
  for (const hour of GREETING_BOUNDARY_HOURS) {
    const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0, 0);
    if (candidate.getTime() > now.getTime()) return candidate;
  }
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
}

/** useSyncExternalStore subscribe function: notifies `callback` at each greeting boundary so a mounted dashboard refreshes without a manual reload. */
export function createGreetingSubscription(callback: () => void): () => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  /** Schedules the next callback and then re-arms itself for the following greeting boundary. */
  function scheduleNext() {
    const delay = getNextGreetingBoundary(new Date()).getTime() - Date.now();
    timeoutId = setTimeout(() => {
      callback();
      scheduleNext();
    }, delay);
  }

  scheduleNext();
  return () => clearTimeout(timeoutId);
}
