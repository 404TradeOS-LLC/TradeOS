import { candidateCostItemCode } from "../modules/costbook/candidateCostItemCode";

describe("candidateCostItemCode", () => {
  it("preserves the full candidate UUID in the generated Cost Item code", () => {
    expect(candidateCostItemCode("12345678-aaaa-4bbb-8ccc-111111111111")).toBe(
      "RC-12345678-AAAA-4BBB-8CCC-111111111111"
    );
  });

  it("does not collide for distinct candidate UUIDs that share the same first eight characters", () => {
    const first = candidateCostItemCode("12345678-aaaa-4bbb-8ccc-111111111111");
    const second = candidateCostItemCode("12345678-bbbb-4ccc-8ddd-222222222222");

    expect(first).not.toBe(second);
  });
});
