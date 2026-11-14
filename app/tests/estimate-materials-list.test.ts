import { inflateSync } from "node:zlib";
import { buildEstimateMaterialsList } from "../modules/estimate-engine/materials-list";
import { renderEstimateMaterialsPdf } from "../modules/estimate-engine/materials-pdf";

const savedLines = [
  { id: "1", description: "60-lb concrete mix", quantity: 47, unitOfMeasure: "bag", section: "Footer", costType: "material", assemblyId: null, unitCost: 4.49, lineCost: 211.03, sortOrder: 1 },
  { id: "2", description: "Install conduit", quantity: 8, unitOfMeasure: "hour", section: "Electrical", costType: "labor", assemblyId: null, unitCost: 100, lineCost: 800, sortOrder: 2 },
  { id: "3", description: "1-inch Schedule 40 electrical conduit", quantity: 27, unitOfMeasure: "10-ft stick", section: "Electrical", costType: "material", assemblyId: null, unitCost: 17.23, lineCost: 465.21, sortOrder: 3 },
  { id: "4", description: "Mixed assembly", quantity: 2, unitOfMeasure: "ea", section: "Electrical", costType: "material", assemblyId: "assembly-1", unitCost: 1000, lineCost: 2000, sortOrder: 4 },
] as const;

describe("customer shopping list projection", () => {
  it("includes explicit material lines in saved order, excludes labor and opaque assemblies, and never returns pricing", () => {
    const result = buildEstimateMaterialsList(savedLines);
    expect(result).toEqual({
      items: [
        { description: "60-lb concrete mix", quantity: 47, unitOfMeasure: "bag", section: "Footer" },
        { description: "1-inch Schedule 40 electrical conduit", quantity: 27, unitOfMeasure: "10-ft stick", section: "Electrical" },
      ],
      unexpandedAssemblyCount: 1,
    });
    expect(JSON.stringify(result)).not.toMatch(/unitCost|lineCost|totalPrice|markup|211\\.03|465\\.21|2000/);
  });

  it("fails closed for invalid material quantities rather than issuing a misleading shopping list", () => {
    expect(() => buildEstimateMaterialsList([{ ...savedLines[0], quantity: Number.NaN }])).toThrow(/quantity/i);
    expect(() => buildEstimateMaterialsList([{ ...savedLines[0], quantity: 0 }])).toThrow(/quantity/i);
  });

  it("does not copy a currency amount embedded in a free-text description", () => {
    const result = buildEstimateMaterialsList([{ ...savedLines[0], description: "Concrete mix $211.03 store price" }]);
    expect(JSON.stringify(result)).not.toContain("$211.03");
  });
});

describe("customer materials PDF", () => {
  it("prints positive four-decimal saved quantities without rounding them to zero", async () => {
    const list = buildEstimateMaterialsList([{ ...savedLines[0], quantity: 0.004 }]);
    const pdf = await renderEstimateMaterialsPdf({
      projectName: "Precision test",
      siteAddress: null,
      customerName: null,
      estimateVersion: 1,
      ...list,
    });
    const body = extractPdfText(pdf);
    expect(body).toContain("0.004 bag");
    expect(body).not.toContain("0 bag");
  });

  it("renders a downloadable checklist without unit prices, totals, or labor charges", async () => {
    const list = buildEstimateMaterialsList(savedLines);
    const pdf = await renderEstimateMaterialsPdf({
      projectName: "Route 63 sign",
      siteAddress: "4050 S State Road 63",
      customerName: "John",
      estimateVersion: 1,
      ...list,
    });
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    const body = extractPdfText(pdf);
    expect(body).toContain("Materials shopping list");
    expect(body).toContain("60-lb concrete mix");
    expect(body).toContain("47 bag");
    expect(body).toContain("27 10-ft stick");
    expect(body).toContain("Assembly");
    for (const forbidden of ["$211.03", "$465.21", "$800", "unit cost", "markup", "total price", "Install conduit"]) {
      expect(body).not.toContain(forbidden);
    }
  });
});

function extractPdfText(pdf: Buffer): string {
  const text: string[] = [];
  const streamMarker = Buffer.from("stream");
  const endMarker = Buffer.from("endstream");
  let offset = 0;
  while (true) {
    const start = pdf.indexOf(streamMarker, offset);
    if (start < 0) break;
    const contentStart = pdf.indexOf(0x0a, start) + 1;
    const end = pdf.indexOf(endMarker, contentStart);
    if (contentStart <= 0 || end < 0) break;
    const raw = pdf.subarray(contentStart, end).subarray(0, -1);
    try {
      const decoded = inflateSync(raw).toString("latin1");
      text.push(...Array.from(decoded.matchAll(/\[([^\]]*)\]\s*TJ/g), match =>
        Array.from(match[1].matchAll(/<([0-9a-f]+)>/gi), hex => Buffer.from(hex[1], "hex").toString("latin1")).join("")
      ));
      text.push(decoded);
    } catch { text.push(raw.toString("latin1")); }
    offset = end + endMarker.length;
  }
  return text.join("\n");
}
