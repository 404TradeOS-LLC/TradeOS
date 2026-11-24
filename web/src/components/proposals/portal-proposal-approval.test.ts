import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const form = readFileSync(new URL("./portal-proposal-approval-form.tsx", import.meta.url), "utf8");
const actions = readFileSync(new URL("../../app/actions/proposals.ts", import.meta.url), "utf8");
const portalPage = readFileSync(new URL("../../app/customer-portal/proposals/[proposalId]/page.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../../lib/api.ts", import.meta.url), "utf8");

test("portal acceptance requires review confirmation, printed name, and a drawn signature", () => {
  assert.match(form, /I have reviewed the scope, allowances, and terms\./);
  assert.match(form, /Drawn signature/);
  assert.match(form, /SignaturePad inputName="signatureDataUrl" onSignatureChange=\{setHasSignature\}/);
  assert.match(form, /const canAccept = reviewed && signerName\.trim\(\)\.length > 0 && hasSignature/);
  assert.match(form, /disabled=\{!canAccept\}/);
});

test("a typed name alone cannot submit: the server re-checks the drawn signature", () => {
  assert.match(actions, /export async function acceptPortalProposalAction/);
  assert.match(actions, /!signatureDataUrl\.startsWith\("data:image\/"\)/);
  // A bare `data:image/` prefix with no decodable image must not pass.
  assert.match(actions, /isValidSignatureDataUrl\(signatureDataUrl\)/);
  assert.match(actions, /Review the scope, allowances, and terms, enter your full name, and draw your signature\./);
});

test("the response is bound to the revision the customer reviewed", () => {
  assert.match(form, /expectedUpdatedAt\?: string/);
  assert.match(form, /name="expectedUpdatedAt"/);
  assert.match(actions, /formData\.get\("expectedUpdatedAt"\)/);
  assert.match(actions, /expectedUpdatedAt,/);
  assert.match(portalPage, /expectedUpdatedAt=\{proposal\.updatedAt\}/);
});

test("the signature statement shows only when signature evidence exists", () => {
  assert.match(portalPage, /proposal\.signatureDataUrl \?/);
  assert.match(portalPage, /The signature is recorded with this proposal, together with the portal link it was accepted from\./);
});

test("portal accept/decline go through the token-scoped portal endpoints, never the staff routes", () => {
  assert.match(actions, /customerPortalApiFetch\(`\/api\/v1\/customer-portal\/proposals\/\$\{id\}\/accept`/);
  assert.match(actions, /customerPortalApiFetch\(`\/api\/v1\/customer-portal\/proposals\/\$\{id\}\/decline`/);
  assert.match(actions, /export async function declinePortalProposalAction/);
  assert.doesNotMatch(actions, /acceptPortalProposalAction[\s\S]{0,800}\/api\/v1\/proposals\//);
});

test("the signer email is never taken from the form: it is resolved server-side", () => {
  assert.doesNotMatch(form, /signerEmail/);
  assert.doesNotMatch(actions, /formData\.get\("signerEmail"\)/);
});

test("the portal proposal page shows the approval form only while the proposal is open, then the recorded response", () => {
  assert.match(portalPage, /PortalProposalApprovalForm/);
  assert.match(portalPage, /proposal\.status === "sent" \|\| proposal\.status === "viewed"/);
  assert.match(portalPage, /Accepted by \{proposal\.signerName/);
  assert.match(portalPage, /proposal\.signedAt \? ` on \$\{formatDateTime\(proposal\.signedAt\)\}`/);
  assert.match(portalPage, /proposal\.declinedReason/);
});

test("the portal proposal type carries the approval record for the accepted/declined states", () => {
  assert.match(api, /signerName\?: string \| null;/);
  assert.match(api, /signatureDataUrl\?: string \| null;/);
  assert.match(api, /signedAt\?: string \| null;/);
  assert.match(api, /declinedReason\?: string \| null;/);
  assert.match(api, /updatedAt\?: string;/);
});
