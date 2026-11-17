/**
 * Input-only search normalization. An omitted county defaults to the pilot
 * region; a deliberately blank county searches statewide references.
 * Never attempt to infer jurisdiction from an arbitrary user query.
 */
export type CodesTopic = "signage" | "permits" | "electrical" | "structural" | "right-of-way";
export type CodesSearchParams = {
  county?: string | string[];
  topic?: string | string[];
  q?: string | string[];
};

const ALLOWED_TOPICS: readonly string[] = ["signage", "permits", "electrical", "structural", "right-of-way"];

function single(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export function normalizeCodesSearchParams(query: CodesSearchParams): {
  county: string;
  topic?: CodesTopic;
  q: string;
} {
  const county = query.county === undefined ? "Vigo" : single(query.county).trim().slice(0, 80);
  const q = single(query.q).trim().slice(0, 120);
  const requestedTopic = single(query.topic);
  const topic = ALLOWED_TOPICS.includes(requestedTopic) ? requestedTopic as CodesTopic : undefined;
  return { county, q, topic };
}
