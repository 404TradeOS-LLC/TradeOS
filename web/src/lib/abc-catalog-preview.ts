/** ABC listing fields are incomplete and provider-owned. Render only recognizable data. */
export function abcFieldLabel(value: unknown): string | null {
  if (typeof value === "string") return value.trim().slice(0, 200) || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  for (const key of ["name", "label", "description", "code", "value"]) {
    const result = row[key];
    if (typeof result === "string" && result.trim()) return result.trim().slice(0, 200);
  }
  return null;
}

export function abcUnitLabels(values: unknown[]): string[] {
  return values.slice(0, 25).flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      const label = abcFieldLabel(value);
      return label ? [label] : [];
    }
    const row = value as Record<string, unknown>;
    const code = abcFieldLabel(row.code);
    const name = abcFieldLabel(row.name);
    const role = abcFieldLabel(row.description);
    // Never discard the provider ordering code or stocking/ordering role.
    const primary = name && code && name !== code ? name + " (" + code + ")" : name ?? code;
    const label = [primary, role && role !== primary ? role : null].filter(Boolean).join(" · ");
    return label ? [label.slice(0, 280)] : [];
  });
}

export function abcVariationLabels(values: unknown[]): string[] {
  return values.slice(0, 30).flatMap((value) => {
    const primary = abcFieldLabel(value);
    if (!value || typeof value !== "object" || Array.isArray(value)) return primary ? [primary] : [];
    const row = value as Record<string, unknown>;
    const size = abcFieldLabel(row.size);
    const lengthObj = row.length;
    const length = abcFieldLabel(lengthObj);
    const lengthUnit = lengthObj && typeof lengthObj === "object" && !Array.isArray(lengthObj)
      ? abcFieldLabel((lengthObj as Record<string, unknown>).uomCode)
        ?? abcFieldLabel((lengthObj as Record<string, unknown>).uom) : null;
    const label = [size ?? primary, length ? ["Length", length, lengthUnit].filter(Boolean).join(" ") : null]
      .filter(Boolean).join(" · ");
    return label ? [label.slice(0, 240)] : [];
  });
}
