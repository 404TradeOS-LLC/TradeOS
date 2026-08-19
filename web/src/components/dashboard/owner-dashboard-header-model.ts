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

export function greetingForHour(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
