import "server-only";
import { apiFetch } from "@/lib/api";

export type CodeTopic = "signage" | "permits" | "electrical" | "structural" | "right-of-way";

export interface CodeReference {
  id: string;
  title: string;
  issuer: string;
  citation: string;
  state: string;
  county: string | null;
  sourceUrl: string;
  sourceDate: string | null;
  reviewedAt: string;
  topics: CodeTopic[];
  summary: string;
  nextAction: string;
  applicability: "unverified";
}

export interface CodeReferenceResult {
  status: "advisory";
  disclaimer: string;
  items: CodeReference[];
  total: number;
}

export function getCostbookCodeReferences(
  token: string,
  query: { state: string; county?: string; topic?: CodeTopic; q?: string }
): Promise<CodeReferenceResult> {
  const params = new URLSearchParams({ state: query.state });
  if (query.county) params.set("county", query.county);
  if (query.topic) params.set("topic", query.topic);
  if (query.q) params.set("q", query.q);
  return apiFetch<CodeReferenceResult>(`/api/v1/costbook/codes?${params.toString()}`, {
    token,
    cache: "no-store",
  });
}
