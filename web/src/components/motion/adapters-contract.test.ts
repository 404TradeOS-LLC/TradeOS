import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

async function readSource(relative: string): Promise<string> {
  return readFile(join(here, relative), "utf8");
}

test("adapter 1: Athena interpretation reveals only from a received draft payload", async () => {
  const assist = await readSource("../estimate-assist/ai-estimate-assist.tsx");
  assert.match(assist, /import \{ ResolveSequence \} from "@\/components\/motion\/resolve-sequence"/);
  assert.match(assist, /import \{ draftCategories \} from "@\/lib\/motion\/adapters"/);
  // A newer generation in flight invalidates the prior draft.
  assert.match(assist, /const interpretationDraft = interpretationPending \? null : structuredDraft;/);
  assert.match(assist, /revealed=\{interpretationDraft !== null\}/);
  assert.match(assist, /categories=\{draftCategories\(interpretationDraft\)\}/);
  // The raw input is the payload's own verbatim scope, not edited text.
  assert.match(assist, /rawInput=\{interpretationDraft\?\.scopeOfWork \?\? submittedScope \?\? scopeOfWork\}/);
});

test("adapter 2: estimate repricing snapshots the last server-confirmed total", async () => {
  const builder = await readSource(
    "../../app/(app)/projects/[id]/estimates/[estimateId]/builder.tsx",
  );
  assert.match(builder, /import \{ PriceDelta \} from "@\/components\/motion\/price-delta"/);
  assert.match(builder, /import \{ nextRecalculationSnapshot, toMinorUnits \} from "@\/lib\/motion\/price-delta"/);
  assert.match(builder, /const invalidate = \(reason\?: string\) => \{/);
  assert.match(builder, /onUpdated\("Line item updated"\)/);
  assert.match(builder, /onUpdated\("Overhead \/ tax saved"\)/);
  assert.match(builder, /onAdded\("Line item added"\)/);
  assert.match(builder, /onAdded\("Custom line item added"\)/);
  assert.match(builder, /onSuccess: \(\) => invalidate\("Line item removed"\)/);
  // USD is the product's existing money convention, not a new assumption.
  assert.match(builder, /currency="USD"/);
  assert.match(builder, /label="Last recalculation"/);
  // A pricing-mode Apply reprices when the percentage changes, so it
  // snapshots with its own reason; a pure mode switch moves no total, so
  // the delta render guard (total must move) prevents a fabricated
  // repricing. Finalize must not fabricate one either.
  assert.match(builder, /onUpdated\("Pricing mode applied"\)/);
  assert.doesNotMatch(builder, /invalidate\("Finaliz/);
  // Concurrent successes before the refetch must not re-attribute their
  // combined change to one edit (see nextRecalculationSnapshot).
  assert.match(builder, /nextRecalculationSnapshot\(/);
});

test("adapter 2: Athena suggestion adds carry their own repricing reason", async () => {
  const panel = await readSource("../estimate-assist/contextual-athena-panel.tsx");
  assert.match(panel, /onAdded\?: \(reason\?: string\) => void;/);
  assert.match(panel, /onAdded\?\.\("Athena suggestion added"\)/);
});

test("adapter 3: estimate to proposal connection confirms only on a created record", async () => {
  const page = await readSource("../../app/(app)/projects/[id]/proposals/[proposalId]/page.tsx");
  assert.match(page, /import \{ ConnectionLine \} from "@\/components\/motion\/connection-line"/);
  assert.match(page, /\{proposal\.estimateId \? \(/);
  assert.match(page, /status="confirmed"/);
  // The creation form itself never renders a confirmed connection.
  const form = await readSource("../../app/(app)/projects/[id]/proposals/new/form.tsx");
  assert.doesNotMatch(form, /ConnectionLine/);
});

test("adapter 4: job and invoice progress render only from validated lifecycle state", async () => {
  const field = await readSource("../../app/(app)/field/page.tsx");
  assert.match(field, /import \{ LifecycleLine \} from "@\/components\/motion\/lifecycle-line"/);
  assert.match(field, /jobLifecycle\(selectedJob\.status\)/);
  assert.match(field, /label="Job progress"/);

  const today = await readSource("../dashboard/today-experience.tsx");
  assert.match(today, /selected\?\.source === "job" \? jobLifecycle\(selected\.status \?\? ""\) : null/);
  assert.match(today, /label="Job progress"/);

  const invoice = await readSource("../../app/(app)/projects/[id]/invoices/[invoiceId]/page.tsx");
  // The stage derives from the payment-aware display status: a partial
  // payment leaves the backend status as "sent" while the badge already
  // reads Partially Paid.
  assert.match(invoice, /invoiceLifecycle\(\{ \.\.\.invoice, status: displayStatus \}\)/);
  assert.match(invoice, /label="Invoice progress"/);
});

test("adapter 1: resolve sequence preserves scope whitespace and enters categories before revealing", async () => {
  const resolve = await readSource("resolve-sequence.tsx");
  // Multi-line scope entries must not collapse into one line.
  assert.match(resolve, /whitespace-pre-wrap/);
  // Categories mount hidden and flip to revealed on the next frame, so the
  // stagger transition runs instead of mounting already revealed.
  assert.match(resolve, /requestAnimationFrame\(\(\) => setEnteredKey\(categoriesKey\)\)/);
  assert.match(resolve, /data-state=\{entered \? "revealed" : "hidden"\}/);
});

test("adapter 4: lifecycle line exposes completed and unconfirmed states to screen readers", async () => {
  const line = await readSource("lifecycle-line.tsx");
  assert.match(line, /completed: "Completed"/);
  assert.match(line, /sr-only/);
  // A bypassed stage was not upcoming, it simply never happened.
  assert.match(line, /upcoming: "Not recorded"/);
  assert.doesNotMatch(line, /upcoming: "Upcoming"/);
});
