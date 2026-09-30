import { NextResponse } from "next/server";
import { ApiClientError, apiFetch } from "@/lib/api";
import { shouldRejectProxyMutation } from "@/lib/proxy-origin";
import { getSessionToken } from "@/lib/session";

const MAX_BATCH_SIZE = 500;

export async function POST(request: Request) {
  if (shouldRejectProxyMutation(request.method, request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "Cross-origin proxy mutation is not allowed" }, { status: 403 });
  }

  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !Array.isArray((body as { rows?: unknown }).rows)) {
    return NextResponse.json({ error: "Body must contain a rows array" }, { status: 400 });
  }

  const rows = (body as { rows: unknown[] }).rows;
  if (rows.length === 0 || rows.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      { error: `Batch size must be between 1 and ${MAX_BATCH_SIZE}` },
      { status: 400 }
    );
  }

  try {
    const result = await apiFetch<{ received: number; upserted: number }>(
      "/api/v1/costbook/benchmarks/composite/import",
      {
        token,
        method: "POST",
        body: JSON.stringify({ rows }),
        cache: "no-store",
      }
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ApiClientError) {
      return NextResponse.json(
        { error: error.message, details: error.details ?? null },
        { status: error.status }
      );
    }
    return NextResponse.json({ error: "Composite benchmark import failed" }, { status: 500 });
  }
}
