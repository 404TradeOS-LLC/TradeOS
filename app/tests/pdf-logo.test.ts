import PDFDocument from "pdfkit";
import { drawValidatedPdfLogo, isDecodablePngImage, validatePdfLogoBytes } from "../modules/documents/pdf-logo";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGPYX2ONFTEMLQkAqeRdgcrsUtEAAAAASUVORK5CYII=", "base64");
// Real 2x2 RGBA PNG (color type 6), built with correct chunk CRCs and a
// valid zlib stream — the same fixture as the proposal acceptance tests.
const rgbaPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGP4z8DwHwyBNBgAAEnICff5q7YNAAAAAElFTkSuQmCC",
  "base64",
);

describe("trusted PDF logo image bytes", () => {
  it("accepts a small valid PNG and rejects arbitrary URLs or SVG payloads", () => {
    expect(validatePdfLogoBytes(png)).not.toBeNull();
    expect(validatePdfLogoBytes(Buffer.from("http://127.0.0.1/private"))).toBeNull();
    expect(validatePdfLogoBytes(Buffer.from("<svg onload='alert(1)'/>"))).toBeNull();
  });
  it("rejects excessive sizes and misleading PNG dimensions", () => {
    expect(validatePdfLogoBytes(Buffer.alloc(1024 * 1024 + 1))).toBeNull();
    const huge = Buffer.from(png);
    huge.writeUInt32BE(10000, 16);
    expect(validatePdfLogoBytes(huge)).toBeNull();
    expect(validatePdfLogoBytes(Buffer.alloc(0))).toBeNull();
  });
  it("safely draws a trusted PNG into a PDF, but ignores malformed bytes", async () => {
    const generate = (image: Buffer) => new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument(); const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      drawValidatedPdfLogo(doc, image, { x: 24, y: 24, width: 64, height: 64 });
      doc.text("Contractor");
      doc.end();
    });
    const embedded = await generate(png);
    const absent = await generate(Buffer.from("not an image"));
    expect(embedded.toString("latin1")).toContain("/Subtype /Image");
    expect(absent.toString("latin1")).not.toContain("/Subtype /Image");
  });
});

describe("PNG pixel-stream pre-validation (isDecodablePngImage)", () => {
  it("accepts structurally sound opaque and alpha PNGs", () => {
    expect(isDecodablePngImage(png)).toBe(true);
    expect(isDecodablePngImage(rgbaPng)).toBe(true);
  });

  it("rejects corrupt IDAT pixel data, bad filter bytes, bad CRCs, and truncation", () => {
    // Corrupt zlib stream (same length, invalid header).
    const corruptIdat = Buffer.from(rgbaPng);
    corruptIdat.fill(0xff, 41, 41 + 18);
    expect(isDecodablePngImage(corruptIdat)).toBe(false);
    // Bad filter byte (first scanline filter 9 instead of 0..4), same
    // structure and valid CRCs otherwise.
    const badFilter = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nOP8z8DwHwyBNBgAAEpqCgDvlywGAAAAAElFTkSuQmCC",
      "base64",
    );
    expect(isDecodablePngImage(badFilter)).toBe(false);
    // Bad chunk CRC (flip a byte in the IHDR CRC).
    const badCrc = Buffer.from(rgbaPng);
    badCrc[29] ^= 0xff;
    expect(isDecodablePngImage(badCrc)).toBe(false);
    // Truncated (IEND cut off).
    expect(isDecodablePngImage(rgbaPng.subarray(0, rgbaPng.length - 12))).toBe(false);
    // Not a PNG at all.
    expect(isDecodablePngImage(Buffer.from("not an image"))).toBe(false);
    expect(isDecodablePngImage(Buffer.alloc(0))).toBe(false);
  });
});

describe("org-logo path pre-validation (drawValidatedPdfLogo)", () => {
  // Same fixtures as the isDecodablePngImage suite, driven through the
  // shared org-logo entry point instead of the validator directly.
  const generate = (image: Buffer) =>
    new Promise<{ drawn: boolean; pdf: Buffer }>((resolve, reject) => {
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve({ drawn, pdf: Buffer.concat(chunks) }));
      doc.on("error", reject);
      const drawn = drawValidatedPdfLogo(doc, image, { x: 24, y: 24, width: 64, height: 64 });
      doc.text("Contractor");
      doc.end();
    });

  it("rejects a header-valid PNG with corrupt IDAT and finishes the PDF without an image", async () => {
    const corruptIdat = Buffer.from(rgbaPng);
    corruptIdat.fill(0xff, 41, 41 + 18);
    const { drawn, pdf } = await generate(corruptIdat);
    expect(drawn).toBe(false);
    expect(pdf.toString("latin1")).not.toContain("/Subtype /Image");
  }, 10000);

  it("rejects a bad-filter PNG and still draws a valid PNG", async () => {
    const badFilter = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nOP8z8DwHwyBNBgAAEpqCgDvlywGAAAAAElFTkSuQmCC",
      "base64",
    );
    const bad = await generate(badFilter);
    expect(bad.drawn).toBe(false);
    expect(bad.pdf.toString("latin1")).not.toContain("/Subtype /Image");
    const good = await generate(rgbaPng);
    expect(good.drawn).toBe(true);
    expect(good.pdf.toString("latin1")).toContain("/Subtype /Image");
  }, 10000);
});
