import { redactDeniedFields } from "../modules/athena-context-engine/redaction";

describe("athena context redaction", () => {
  it("returns the original data unchanged when there are no denied fields", () => {
    const data = { customer: { name: "Ada", email: "ada@example.com" } };
    const result = redactDeniedFields(data, []);
    expect(result.data).toEqual(data);
    expect(result.redactedFields).toEqual([]);
  });

  it("redacts a nested flat field path", () => {
    const data = { customer: { name: "Ada", email: "ada@example.com" } };
    const result = redactDeniedFields(data, ["customer.email"]);
    expect(result.data).toEqual({ customer: { name: "Ada" } });
    expect(result.redactedFields).toEqual(["customer.email"]);
  });

  it("redacts a field across every element of an array using a wildcard segment", () => {
    const data = { jobs: [{ id: "1", customer: { email: "a@example.com" } }, { id: "2", customer: { email: "b@example.com" } }] };
    const result = redactDeniedFields(data, ["jobs.*.customer.email"]);
    expect(result.data).toEqual({ jobs: [{ id: "1", customer: {} }, { id: "2", customer: {} }] });
  });

  it("does not mutate the original input object", () => {
    const data = { customer: { email: "ada@example.com" } };
    redactDeniedFields(data, ["customer.email"]);
    expect(data.customer.email).toBe("ada@example.com");
  });

  it("reports only the paths that actually existed and were removed", () => {
    const data = { customer: { name: "Ada" } };
    const result = redactDeniedFields(data, ["customer.email", "customer.name"]);
    expect(result.redactedFields).toEqual(["customer.name"]);
    expect(result.data).toEqual({ customer: {} });
  });

  it("is a no-op for a path that does not exist in the data", () => {
    const data = { customer: { name: "Ada" } };
    const result = redactDeniedFields(data, ["customer.ssn"]);
    expect(result.data).toEqual(data);
    expect(result.redactedFields).toEqual([]);
  });
});
