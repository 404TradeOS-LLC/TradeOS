import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// DES-10-F7: the recorded portal signature is stored on the proposal row
// and carried by the Proposal DTO, but the staff proposal page never
// rendered it — there was no acceptance section at all. The acceptance
// card renders the recorded signature image with the signer name and
// date, and renders nothing when no acceptance evidence exists.
const card = readFileSync(new URL("./proposal-acceptance-card.tsx", import.meta.url), "utf8");
const page = readFileSync(
  new URL("../../app/(app)/projects/[id]/proposals/[proposalId]/page.tsx", import.meta.url),
  "utf8",
);

test("acceptance card renders the recorded signature image with signer name and date", () => {
  assert.match(card, /proposal\.signatureDataUrl/);
  assert.match(card, /<img[^>]*src=\{proposal\.signatureDataUrl\}/);
  assert.match(card, /proposal\.signerName/);
  assert.match(card, /proposal\.signedAt/);
  assert.match(card, /formatDateTime\(proposal\.signedAt\)/);
});

test("acceptance card renders nothing when the proposal carries no acceptance evidence", () => {
  assert.match(card, /proposal\.status === "accepted"/);
  assert.match(card, /return null/);
});

test("staff proposal page shows the acceptance card next to the workflow actions", () => {
  assert.match(page, /import \{ ProposalAcceptanceCard \} from "@\/components\/proposals\/proposal-acceptance-card"/);
  assert.match(page, /<ProposalAcceptanceCard proposal=\{proposal\} \/>/);
});
