import fs from "node:fs";
import path from "node:path";

describe("Vercel PDFKit bundle", () => {
  it("includes PDFKit standard-font modules in the Express function bundle", () => {
    const configPath = path.resolve(__dirname, "../vercel.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
      functions?: Record<string, { includeFiles?: string }>;
    };

    const includeFiles = config.functions?.["index.ts"]?.includeFiles ?? "";

    expect(includeFiles).toContain("vendor/knowledge-engine/**");
    expect(includeFiles).toContain("node_modules/pdfkit/js/standard-fonts/**");
  });
});
