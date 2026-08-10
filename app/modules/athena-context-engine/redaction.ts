// Denied-field redaction (docs/athena/roadmap/
// A3-context-engine-implementation-plan.md "Context Minimization,
// Sensitivity, And Redaction": "deniedFields filtering happens before a
// section is attached to the context"). Generic over provider data shape -
// operates on dot-separated paths with an optional "*" wildcard segment for
// arrays, so it works for both a flat object (customer.email) and a list of
// records (jobs.*.customer.email) without any provider-specific code.
export interface AthenaContextRedactionResult<TData> {
  data: TData;
  redactedFields: string[];
}

export function redactDeniedFields<TData>(data: TData, deniedFieldPaths: readonly string[]): AthenaContextRedactionResult<TData> {
  if (deniedFieldPaths.length === 0) {
    return { data, redactedFields: [] };
  }
  const clone = structuredClone(data);
  const redactedFields: string[] = [];
  for (const path of deniedFieldPaths) {
    if (deleteAtPath(clone, path.split("."))) {
      redactedFields.push(path);
    }
  }
  return { data: clone, redactedFields };
}

function deleteAtPath(node: unknown, segments: string[]): boolean {
  if (segments.length === 0 || node === null || typeof node !== "object") {
    return false;
  }
  const [head, ...rest] = segments;

  if (head === "*") {
    if (!Array.isArray(node)) return false;
    let deletedAny = false;
    for (const item of node) {
      if (deleteAtPath(item, rest)) deletedAny = true;
    }
    return deletedAny;
  }

  const record = node as Record<string, unknown>;
  if (!(head in record)) return false;

  if (rest.length === 0) {
    delete record[head];
    return true;
  }
  return deleteAtPath(record[head], rest);
}
