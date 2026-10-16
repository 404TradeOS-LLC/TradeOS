/** Display-only grouping of saved Estimate Engine lineCost snapshots. */
const categories = [
  { type: "material", label: "Materials" },
  { type: "labor", label: "Labor" },
  { type: "equipment", label: "Equipment" },
  { type: "subcontractor", label: "Subcontractors" },
  { type: "disposal", label: "Disposal" },
  { type: "other", label: "Other" },
] as const;

export function groupSavedDirectCosts(lines: ReadonlyArray<{ costType: string; lineCost: number }>) {
  return categories.flatMap(({ type, label }) => {
    const rows = lines.filter((line) => line.costType === type);
    if (!rows.length) return [];
    const cents = rows.map((row) => Math.round(row.lineCost * 100));
    const sum = cents.reduce((total, amount) => total + amount, 0);
    return [{ type, label, amount: cents.every(Number.isSafeInteger) && Number.isSafeInteger(sum) ? sum / 100 : null }];
  });
}
