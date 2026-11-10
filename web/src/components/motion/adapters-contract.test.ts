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
  assert.match(builder, /const invalidate = \(reason\?: string, previousTotalMinor\?: number \| null\) => \{/);
  assert.match(builder, /onUpdated\("Line item updated", context\?\.previousTotalMinor\)/);
  assert.match(builder, /onUpdated\("Overhead \/ tax saved", context\?\.previousTotalMinor\)/);
  assert.match(builder, /onAdded\("Line item added", context\?\.previousTotalMinor\)/);
  assert.match(builder, /onAdded\("Custom line item added", context\?\.previousTotalMinor\)/);
  assert.match(builder, /onSuccess: \(_data, _variables, context\) => invalidate\("Line item removed", context\?\.previousTotalMinor\)/);
  // USD is the product's existing money convention, not a new assumption.
  assert.match(builder, /currency="USD"/);
  assert.match(builder, /label="Last recalculation"/);
  // A pricing-mode Apply reprices when the percentage changes, so it
  // snapshots with its own reason; a pure mode switch moves no total, so
  // the delta render guard (total must move) prevents a fabricated
  // repricing. Finalize must not fabricate one either.
  assert.match(builder, /onUpdated\("Pricing mode applied", context\?\.previousTotalMinor\)/);
  assert.doesNotMatch(builder, /invalidate\("Finaliz/);
  // Concurrent successes before the refetch must not re-attribute their
  // combined change to one edit (see nextRecalculationSnapshot).
  assert.match(builder, /nextRecalculationSnapshot\(/);
  // Refetch completion is tracked independently of whether the total
  // moved: a price-neutral save's pending snapshot is cleared once its
  // refetch lands with the total still equal to the baseline, so it
  // cannot suppress the next price-changing edit's delta. A moved total
  // keeps its snapshot, and a snapshot superseded by a later edit is
  // never cleared by an older refetch. A failed or skipped refetch
  // leaves the snapshot in place.
  assert.match(builder, /const lastRecalculationRef = useRef/);
  assert.match(builder, /lastRecalculationRef\.current !== mine/);
  assert.match(builder, /queryState\.dataUpdatedAt/);
  assert.match(builder, /freshMinor === mine\.previousTotalMinor/);
});

test("adapter 2: Athena suggestion adds carry their own repricing reason", async () => {
  const panel = await readSource("../estimate-assist/contextual-athena-panel.tsx");
  assert.match(panel, /onAdded\?: \(reason\?: string, previousTotalMinor\?: number \| null\) => void;/);
  assert.match(panel, /onAdded\?\.\("Athena suggestion added", previousTotalMinor\)/);
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
  assert.match(resolve, /requestAnimationFrame\(\(\) => setEnteredKey\(entryKey\)\)/);
  assert.match(resolve, /data-state=\{entered \? "revealed" : "hidden"\}/);
  // A new generation replays the reveal even when its categories are
  // identical to the last one: entry state is keyed by generation as
  // well as content. Without a generation key, identical content stays
  // entered (no replay).
  assert.match(resolve, /generationKey\?: string;/);
  assert.match(resolve, /const entryKey = props\.generationKey === undefined \? categoriesKey : `\$\{props\.generationKey\}\\n\$\{categoriesKey\}`;/);
});

test("adapter 1: Athena interpretation replays the reveal for each generation", async () => {
  const assist = await readSource("../estimate-assist/ai-estimate-assist.tsx");
  // The generation identity is a local counter incremented on every
  // successful regeneration — it does not rely on the server's optional
  // generationId, which may be absent on older payloads.
  assert.match(assist, /const \[generationSequence, setGenerationSequence\] = useState\(0\);/);
  assert.match(assist, /setGenerationSequence\(\(n\) => n \+ 1\);/);
  assert.match(assist, /generationKey=\{`generation-\$\{generationSequence\}`\}/);
});

test("adapter 4: lifecycle line exposes completed and unconfirmed states to screen readers", async () => {
  const line = await readSource("lifecycle-line.tsx");
  assert.match(line, /completed: "Completed"/);
  assert.match(line, /sr-only/);
  // A bypassed stage was not upcoming, it simply never happened.
  assert.match(line, /upcoming: "Not recorded"/);
  assert.doesNotMatch(line, /upcoming: "Upcoming"/);
});
