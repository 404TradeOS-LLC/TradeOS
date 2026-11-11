import {
  CODES_SOURCE_MAX_BYTES,
  assertOfficialSourceUrl,
  computeSourceHash,
  fetchOfficialSourceBytes,
  isOfficialSourceUrl,
} from "../modules/costbook/codes/sourceAllowlist";

const textEncoder = new TextEncoder();
const okResponse = (body: string, headers: Record<string, string> = {}) =>
  new Response(textEncoder.encode(body), { status: 200, headers });

describe("official source URL allowlist (SSRF policy)", () => {
  it("allows the verified issuer hosts and their subdomains", () => {
    expect(isOfficialSourceUrl("https://www.vigocounty.in.gov/egov/docs/1088861399_472198.pdf")).toBe(true);
    expect(isOfficialSourceUrl("https://vigocounty.in.gov/egov/docs/x.pdf")).toBe(true);
    expect(isOfficialSourceUrl("https://www.in.gov/dhs/boards-and-commissions/fpbsc-rules/")).toBe(true);
    expect(isOfficialSourceUrl("https://www.in.gov/indot/doing-business-with-indot/permits/")).toBe(true);
    expect(isOfficialSourceUrl("https://in.gov/indot/")).toBe(true);
    expect(isOfficialSourceUrl("https://erms.indot.in.gov/Section106Documents")).toBe(true);
    expect(isOfficialSourceUrl("https://iga.in.gov/legislative/laws")).toBe(true);
  });

  it("refuses every untrusted host, with no fetch attempted", () => {
    const refused = [
      "https://evil.com/ordinance.pdf",
      "https://in.gov.evil.com/x.pdf",
      "https://evil-in.gov/x.pdf",
      "https://vigocounty.in.gov.evil.com/x.pdf",
      "https://www.vigocounty.in.gov.attacker.example/x.pdf",
      "https://not-in-gov.example/x.pdf",
      "https://localhost:8443/x.pdf",
      "https://127.0.0.1/x.pdf",
      "https://169.254.169.254/latest/meta-data/",
      "https://[::1]/x.pdf",
      "https://10.0.0.5/x.pdf",
    ];
    for (const url of refused) {
      expect(isOfficialSourceUrl(url)).toBe(false);
      expect(() => assertOfficialSourceUrl(url)).toThrow();
    }
  });

  it("refuses http, credentials, non-443 ports, and malformed URLs", () => {
    expect(isOfficialSourceUrl("http://www.in.gov/indot/")).toBe(false);
    expect(isOfficialSourceUrl("https://user:pass@www.in.gov/indot/")).toBe(false);
    expect(isOfficialSourceUrl("https://www.in.gov:8443/indot/")).toBe(false);
    expect(isOfficialSourceUrl("https://www.in.gov:80/indot/")).toBe(false);
    expect(isOfficialSourceUrl("not a url")).toBe(false);
    expect(isOfficialSourceUrl("")).toBe(false);
    expect(() => assertOfficialSourceUrl("http://www.in.gov/")).toThrow("https");
  });

  it("accepts an explicit :443 port and normalizes host case", () => {
    expect(isOfficialSourceUrl("https://WWW.IN.GOV/indot/")).toBe(true);
    expect(isOfficialSourceUrl("https://www.in.gov:443/indot/")).toBe(true);
  });
});

describe("constrained official-source fetch", () => {
  it("hashes the exact bytes and reports the hash", async () => {
    const body = "official ordinance bytes";
    const result = await fetchOfficialSourceBytes("https://www.in.gov/indot/permits/", {
      fetchImpl: async () => okResponse(body),
    });
    expect(result.sourceHash).toBe(computeSourceHash(textEncoder.encode(body)));
    expect(result.fetchedBytes).toBe(textEncoder.encode(body).byteLength);
    expect(result.finalUrl).toBe("https://www.in.gov/indot/permits/");
  });

  it("never calls fetch for an untrusted URL", async () => {
    const fetchImpl = jest.fn(async () => okResponse("x"));
    await expect(
      fetchOfficialSourceBytes("https://evil.com/x.pdf", { fetchImpl }),
    ).rejects.toThrow("not an allowlisted official source host");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("follows allowlisted redirects and refuses off-allowlist redirect targets", async () => {
    const requested: string[] = [];
    const fetchImpl: typeof fetch = async (url) => {
      requested.push(String(url));
      if (String(url) === "https://www.in.gov/indot/permits/") {
        return new Response(null, { status: 302, headers: { location: "https://www.in.gov/indot/2703.htm" } });
      }
      return okResponse("final");
    };
    const followed = await fetchOfficialSourceBytes("https://www.in.gov/indot/permits/", { fetchImpl });
    expect(followed.finalUrl).toBe("https://www.in.gov/indot/2703.htm");
    expect(requested).toEqual(["https://www.in.gov/indot/permits/", "https://www.in.gov/indot/2703.htm"]);

    const evilRedirect: typeof fetch = async (url) => {
      requested.push(String(url));
      return new Response(null, { status: 302, headers: { location: "https://evil.com/steal" } });
    };
    await expect(
      fetchOfficialSourceBytes("https://www.in.gov/indot/permits/", { fetchImpl: evilRedirect }),
    ).rejects.toThrow("not an allowlisted official source host");
    expect(requested).not.toContain("https://evil.com/steal");
  });

  it("fails closed on non-2xx and on timeout", async () => {
    await expect(
      fetchOfficialSourceBytes("https://www.in.gov/indot/permits/", {
        fetchImpl: async () => new Response("nope", { status: 404 }),
      }),
    ).rejects.toMatchObject({ statusCode: 502 });

    const hangingFetch: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
      });
    await expect(
      fetchOfficialSourceBytes("https://www.in.gov/indot/permits/", { fetchImpl: hangingFetch, timeoutMs: 5 }),
    ).rejects.toMatchObject({ statusCode: 504 });
  });

  it("refuses oversize bodies without reading them into the pipeline", async () => {
    await expect(
      fetchOfficialSourceBytes("https://www.in.gov/indot/permits/", {
        fetchImpl: async () => okResponse("12345678901234567890"),
        maxBytes: 10,
      }),
    ).rejects.toMatchObject({ statusCode: 502 });
    expect(CODES_SOURCE_MAX_BYTES).toBe(5 * 1024 * 1024);
  });
});
