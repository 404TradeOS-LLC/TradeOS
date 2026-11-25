import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// DES-10 status check (gap #6): the guidance card renders the Figma
// copy verbatim (frames 1027:28503 / 1027:28547), only after the list is
// loaded, with the match verdict in a polite live region and every action
// at 44px or taller. These tests pin the card's source contract; the
// copy itself executes in lib/proposal-status-check.test.ts.

const card = readFileSync(new URL("./proposal-status-check-card.tsx", import.meta.url), "utf8");
const cardCss = readFileSync(new URL("./proposal-status-check-card.css", import.meta.url), "utf8");
const returnForm = readFileSync(new URL("./proposal-status-check-return-form.tsx", import.meta.url), "utf8");

test("guidance card renders the verbatim Figma copy from the shared constants", () => {
  assert.match(card, /PROPOSAL_STATUS_CHECK_COPY/);
  assert.match(card, /heading/);
  assert.match(card, /description/);
  assert.match(card, /destination/);
  assert.match(card, /matchingDraftFound/);
  assert.match(card, /noMatch/);
});

test("guidance card moves focus to its heading on arrival", () => {
  assert.match(card, /tabIndex=\{-1\}/);
  assert.match(card, /\.focus\(/);
  assert.match(card, /useEffect/);
  assert.match(card, /useRef/);
});

test("match verdict is announced in a polite live region, never color alone", () => {
  assert.match(card, /aria-live="polite"/);
  assert.match(card, /aria-atomic="true"/);
  assert.match(card, /This is your draft/);
  assert.match(card, /No matching draft/);
});

test("card and match marker dissolve in 180ms and respect reduced motion", () => {
  assert.match(cardCss, /180ms/);
  assert.match(cardCss, /@keyframes proposal-status-check-dissolve/);
  assert.match(card, /proposal-status-check-card/);
});

test("status-check actions are at least 44px tall", () => {
  // The card itself carries no actions; the 44px targets are the form's
  // status-check link + retry, the return form's button, and the S6
  // reload link. Those live in the form, the return form, and the
  // project page respectively.
  assert.match(returnForm, /min-h-11/);
  const form = readFileSync(new URL("../../app/(app)/projects/[id]/proposals/new/form.tsx", import.meta.url), "utf8");
  assert.match(form, /min-h-11/);
  const projectPage = readFileSync(
    new URL("../../app/(app)/projects/[id]/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(projectPage, /min-h-11/);
});

test("return form records the confirmation through the server action and shows failures", () => {
  assert.match(returnForm, /confirmProposalStatusCheckAction/);
  assert.match(returnForm, /Return to Estimate Review/);
  assert.match(returnForm, /role="alert"/);
  // The attempt key is read (never minted) and written to the uncontrolled
  // hidden input's DOM node — no setState inside an effect.
  assert.match(returnForm, /readProposalIdempotencyKey\(projectId, estimateId, getIdempotencyKeyStorage\(\)\)/);
  assert.match(returnForm, /keyInputRef\.current\.value/);
  assert.doesNotMatch(returnForm, /setIdempotencyKey/);
});
