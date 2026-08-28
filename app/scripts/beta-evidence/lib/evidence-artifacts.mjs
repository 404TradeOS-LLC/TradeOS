// Pure helpers describing the required beta-evidence artifact set and
// validating a captured set against it. Kept free of I/O so `node --test` can
// exercise the acceptance rules directly.

// Phase 16 viewport matrix. Widths are fixed by the beta evidence contract;
// heights follow the heights already established by
// app/scripts/s027-browser-evidence.mjs so the two evidence lanes agree.
export const VIEWPORTS = Object.freeze([
  Object.freeze({ name: "1440", width: 1440, height: 1000, label: "Desktop" }),
  Object.freeze({ name: "1024", width: 1024, height: 900, label: "Small Desktop" }),
  Object.freeze({ name: "768", width: 768, height: 1024, label: "Tablet" }),
  Object.freeze({ name: "390", width: 390, height: 844, label: "Mobile" }),
]);

// Phase 17 checkpoints. `required: false` marks a checkpoint that only exists
// when the underlying product surface does; a missing optional checkpoint is
// recorded as N/A rather than silently dropped.
export const CHECKPOINTS = Object.freeze([
  Object.freeze({ sequence: "01", name: "authenticated-shell", required: true }),
  Object.freeze({ sequence: "02", name: "project-or-customer", required: true }),
  Object.freeze({ sequence: "03", name: "estimate-edit", required: true }),
  Object.freeze({ sequence: "04", name: "estimate-pricing", required: true }),
  Object.freeze({ sequence: "05", name: "estimate-reloaded", required: true }),
  Object.freeze({ sequence: "06", name: "estimate-finalized", required: true }),
  Object.freeze({ sequence: "07", name: "proposal", required: true }),
  Object.freeze({ sequence: "08", name: "downstream-state", required: false }),
]);

export const WORKFLOW_SLUG = "beta";

/** `<workflow>-<viewport>-<sequence>-<checkpoint>.png` */
export function screenshotFileName(viewportName, sequence, checkpointName) {
  return `${WORKFLOW_SLUG}-${viewportName}-${sequence}-${checkpointName}.png`;
}

export function expectedScreenshots({ includeOptional = false } = {}) {
  const names = [];
  for (const viewport of VIEWPORTS) {
    for (const checkpoint of CHECKPOINTS) {
      if (!checkpoint.required && !includeOptional) continue;
      names.push({
        file: screenshotFileName(viewport.name, checkpoint.sequence, checkpoint.name),
        viewport: viewport.name,
        expectedWidth: viewport.width,
        checkpoint: checkpoint.name,
        required: checkpoint.required,
      });
    }
  }
  return names;
}

/**
 * Read a PNG's intrinsic pixel dimensions from its IHDR chunk.
 * Returns null when the buffer is not a PNG.
 */
export function readPngDimensions(buffer) {
  if (!buffer || buffer.length < 24) return null;
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let index = 0; index < signature.length; index += 1) {
    if (buffer[index] !== signature[index]) return null;
  }
  // Bytes 12-16 must be the "IHDR" chunk type.
  if (buffer.toString("ascii", 12, 16) !== "IHDR") return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

/**
 * Phase 22 acceptance. `captured` is a list of
 * `{ file, bytes, width, height }` describing what actually landed on disk.
 * Returns `{ ok, failures[] }` — never throws, so callers can report every
 * problem at once instead of one per run.
 */
export function validateEvidenceSet(captured, { includeOptional = false } = {}) {
  const failures = [];
  const byName = new Map((captured ?? []).map((entry) => [entry.file, entry]));

  for (const expected of expectedScreenshots({ includeOptional })) {
    const actual = byName.get(expected.file);
    if (!actual) {
      failures.push({ file: expected.file, code: "MISSING", detail: "required screenshot was not captured" });
      continue;
    }
    if (!Number.isFinite(actual.bytes) || actual.bytes <= 0) {
      failures.push({ file: expected.file, code: "EMPTY", detail: `screenshot is ${actual.bytes} bytes` });
      continue;
    }
    if (actual.width !== expected.expectedWidth) {
      failures.push({
        file: expected.file,
        code: "WRONG_WIDTH",
        detail: `expected width ${expected.expectedWidth}px but the image is ${actual.width}px`,
      });
    }
  }

  const representedViewports = new Set(
    (captured ?? [])
      .map((entry) => /^beta-(\d+)-/.exec(entry.file)?.[1])
      .filter(Boolean),
  );
  for (const viewport of VIEWPORTS) {
    if (!representedViewports.has(viewport.name)) {
      failures.push({
        file: viewport.name,
        code: "VIEWPORT_UNREPRESENTED",
        detail: `no evidence was captured at ${viewport.width}px`,
      });
    }
  }

  return { ok: failures.length === 0, failures };
}

/**
 * Phase 23 screenshot truth check. Given the page state recorded alongside a
 * checkpoint, decide whether it is genuine product evidence.
 */
export function assessScreenshotTruth({ pathname, title, bodyText, checkpoint }) {
  const text = (bodyText ?? "").trim();
  const problems = [];

  if (text.length === 0) problems.push("page rendered an empty body");
  if (pathname === "/login") problems.push("page is the login screen, not authenticated product state");
  if (/^\/(?:signup|forgot-password|reset-password)$/.test(pathname ?? "")) {
    problems.push(`page is an unauthenticated route (${pathname})`);
  }
  if (/this page could not be found/i.test(text)) problems.push("page is a 404 not-found screen");
  if (/application error|internal server error|500\b/i.test(text)) problems.push("page is a server error screen");
  if (/^loading tradeos…?$/i.test(text)) problems.push("page never resolved past its loading state");

  return { ok: problems.length === 0, checkpoint, problems };
}

/** Phase 18/19 responsive quality gate. */
export function assessResponsiveQuality({ viewport, scrollWidth, clientWidth, obscuredControls = [] }) {
  const problems = [];
  // 2px tolerance matches s027-browser-evidence.mjs so the gates agree.
  if (Number.isFinite(scrollWidth) && Number.isFinite(clientWidth) && scrollWidth > clientWidth + 2) {
    problems.push(`horizontal overflow: scrollWidth ${scrollWidth} exceeds clientWidth ${clientWidth}`);
  }
  for (const control of obscuredControls) {
    problems.push(`control "${control}" is not reachable at ${viewport}px`);
  }
  return { ok: problems.length === 0, viewport, problems };
}
