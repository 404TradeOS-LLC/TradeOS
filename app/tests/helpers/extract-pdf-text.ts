import { inflateSync } from "node:zlib";

// Reads text from the compressed PDFKit streams used by our fixtures.
export function extractPdfText(pdf: Buffer): string {
  const text: string[] = [];
  const streamMarker = Buffer.from("stream");
  const endMarker = Buffer.from("endstream");
  let offset = 0;

  while (true) {
    const streamStart = pdf.indexOf(streamMarker, offset);
    if (streamStart < 0) break;
    const contentStart = pdf.indexOf(0x0a, streamStart) + 1;
    const streamEnd = pdf.indexOf(endMarker, contentStart);
    if (contentStart <= 0 || streamEnd < 0) break;
    const raw = pdf.subarray(contentStart, streamEnd).subarray(0, -1);
    try {
      const decoded = inflateSync(raw).toString("latin1");
      const tjText = Array.from(decoded.matchAll(/\[([^\]]*)\]\s*TJ/g), (match) =>
        Array.from(match[1].matchAll(/<([0-9a-f]+)>/gi), (hex) => Buffer.from(hex[1], "hex").toString("latin1")).join("")
      );
      text.push(decoded, ...tjText);
    } catch {
      text.push(raw.toString("latin1"));
    }
    offset = streamEnd + endMarker.length;
  }

  return text.join("\n");
}
