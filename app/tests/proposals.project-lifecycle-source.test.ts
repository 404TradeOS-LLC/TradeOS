import fs from "node:fs";
import path from "node:path";

const servicePath = path.resolve(__dirname, "../modules/proposals/service.ts");
const source = fs.readFileSync(servicePath, "utf8");

function methodSlice(startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("proposal-driven Project lifecycle source contract", () => {
  it("keeps estimate-backed proposal creation in canonical estimating", () => {
    const body = methodSlice("  private async createFromEstimate", "  private async createFromProject");
    expect(body).toContain('await prisma.project.update({ where: { id: estimate.projectId }, data: { status: "estimating" } });');
  });

  it("keeps reject and duplicate side effects in canonical estimating", () => {
    const rejectBody = methodSlice("  async reject(", "  async resend(");
    const duplicateBody = methodSlice("  async duplicate(", "  private async findOrThrow");
    expect(rejectBody).toContain('data: { status: "estimating" }');
    expect(duplicateBody).toContain('data: { status: "estimating" }');
  });

  it("keeps acceptance in canonical awarded", () => {
    const acceptBody = methodSlice("  async accept(", "  async reject(");
    expect(acceptBody).toContain('data: { status: "awarded" }');
  });
});
