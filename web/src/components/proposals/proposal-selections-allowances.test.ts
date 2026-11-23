import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const component = readFileSync(new URL("./proposal-selections-allowances.tsx", import.meta.url), "utf8");
const readonlyComponent = readFileSync(new URL("./proposal-selections-allowances-readonly.tsx", import.meta.url), "utf8");
const actions = readFileSync(new URL("../../app/actions/proposals.ts", import.meta.url), "utf8");
const api = readFileSync(new URL("../../lib/api.ts", import.meta.url), "utf8");
const badge = readFileSync(new URL("../shared/status-badge.tsx", import.meta.url), "utf8");
const detailPage = readFileSync(
  new URL("../../app/(app)/projects/[id]/proposals/[proposalId]/page.tsx", import.meta.url),
  "utf8"
);
const portalPage = readFileSync(new URL("../../app/customer-portal/proposals/[proposalId]/page.tsx", import.meta.url), "utf8");

test("selections and allowances render on the staff proposal detail page", () => {
  assert.match(detailPage, /ProposalSelectionsAllowances/);
  assert.match(component, /03 · Selections/);
  assert.match(component, /04 · Allowances/);
  assert.match(component, /Total allowance/);
});

test("the allowances total is display-only and never presented as part of the proposal price", () => {
  assert.match(component, /not added to the proposal total/);
  assert.match(readonlyComponent, /not added to the proposal investment/);
});

test("selection and allowance writes go through dedicated server actions and endpoints", () => {
  assert.match(actions, /export async function createProposalSelectionAction/);
  assert.match(actions, /export async function updateProposalSelectionAction/);
  assert.match(actions, /export async function deleteProposalSelectionAction/);
  assert.match(actions, /export async function createProposalAllowanceAction/);
  assert.match(actions, /export async function updateProposalAllowanceAction/);
  assert.match(actions, /export async function deleteProposalAllowanceAction/);
  assert.match(actions, /\/selections/);
  assert.match(actions, /\/allowances/);
  assert.match(actions, /revalidatePath\(`\/projects\/\$\{projectId\}\/proposals\/\$\{proposalId\}`\)/);
});

test("selection decisions use the Figma statuses with the shared badge tones", () => {
  assert.match(api, /status: "action_required" \| "confirmed"/);
  assert.match(badge, /action_required: TONE_WARNING/);
  assert.match(badge, /confirmed: TONE_SUCCESS/);
});

test("accepted proposals are read-only in the staff editor", () => {
  assert.match(component, /proposal\.status !== "accepted"/);
  assert.match(component, /This proposal is accepted, so selections and allowances are read-only here/);
});

test("the customer portal shows selections and allowances read-only, and nothing when there are none", () => {
  assert.match(portalPage, /ProposalSelectionsAllowancesReadonly/);
  assert.match(readonlyComponent, /if \(selections\.length === 0 && allowances\.length === 0\) return null;/);
});
