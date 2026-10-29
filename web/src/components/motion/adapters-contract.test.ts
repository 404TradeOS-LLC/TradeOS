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
  assert.match(builder, /import \{ toMinorUnits \} from "@\/lib\/motion\/price-delta"/);
  assert.match(builder, /const invalidate = \(reason\?: string\) => \{/);
  assert.match(builder, /onUpdated\("Line item updated"\)/);
  assert.match(builder, /onUpdated\("Overhead \/ tax saved"\)/);
  assert.match(builder, /onAdded\("Line item added"\)/);
  assert.match(builder, /onAdded\("Custom line item added"\)/);
  assert.match(builder, /onSuccess: \(\) => invalidate\("Line item removed"\)/);
  // USD is the product's existing money convention, not a new assumption.
  assert.match(builder, /currency="USD"/);
  assert.match(builder, /label="Last recalculation"/);
  // Finalize and pricing-mode switches must not fabricate a repricing.
  assert.doesNotMatch(builder, /invalidate\("Finaliz/);
  assert.doesNotMatch(builder, /onUpdated\("Pricing mode/);
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
  assert.match(invoice, /invoiceLifecycle\(invoice\)/);
  assert.match(invoice, /label="Invoice progress"/);
});
