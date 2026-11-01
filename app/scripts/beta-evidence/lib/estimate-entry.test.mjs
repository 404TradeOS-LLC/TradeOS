import test from "node:test";
import assert from "node:assert/strict";
import { openEstimateCustomEntry } from "./estimate-entry.mjs";

// Minimal Playwright-locator stand-in modelling the "Custom item"
// disclosure: the button toggles aria-expanded and reveals the editor,
// except that a configured number of leading clicks are lost (remount /
// stage transition), reproducing the 2026-11-01 beta-evidence failure where
// the editor stayed hidden behind the disclosure.
function fakePage({ buttonCount = 1, expanded = false, editorVisible = false, lostClicks = 0 } = {}) {
  const state = { expanded, editorVisible, clicks: 0, buttonWaits: [] };
  const button = {
    count: async () => buttonCount,
    getAttribute: async (name) => (name === "aria-expanded" ? String(state.expanded) : null),
    click: async () => {
      state.clicks += 1;
      if (state.clicks <= lostClicks) return;
      state.expanded = true;
      state.editorVisible = true;
    },
    waitFor: async ({ state: wanted }) => {
      state.buttonWaits.push(wanted);
      if (buttonCount === 0 || wanted !== "visible") throw new Error("button never visible");
    },
  };
  const editor = {
    waitFor: async ({ state: wanted }) => {
      if (wanted === "visible" && !state.editorVisible) throw new Error("editor timeout");
    },
  };
  return {
    state,
    getByRole: (role, { name }) => {
      assert.equal(role, "button");
      assert.equal(name, "Custom item");
      return button;
    },
    getByLabel: (label) => {
      assert.equal(label, "Custom line item");
      return editor;
    },
  };
}

test("opens the panel on one click when collapsed", async () => {
  const page = fakePage();
  const editor = await openEstimateCustomEntry(page);
  assert.ok(editor);
  assert.equal(page.state.clicks, 1);
  assert.equal(page.state.editorVisible, true);
  assert.deepEqual(page.state.buttonWaits, ["visible"]);
});

test("retries the click when the first click is lost to a remount", async () => {
  const page = fakePage({ lostClicks: 1 });
  const editor = await openEstimateCustomEntry(page);
  assert.ok(editor);
  assert.equal(page.state.clicks, 2);
});

test("does not click when the panel is already expanded", async () => {
  const page = fakePage({ expanded: true, editorVisible: true });
  const editor = await openEstimateCustomEntry(page);
  assert.ok(editor);
  assert.equal(page.state.clicks, 0);
});

test("falls back to the editor directly when no disclosure button exists", async () => {
  const page = fakePage({ buttonCount: 0, editorVisible: true });
  const editor = await openEstimateCustomEntry(page);
  assert.ok(editor);
  assert.equal(page.state.clicks, 0);
  assert.deepEqual(page.state.buttonWaits, []);
});

test("surfaces the genuine failure when the panel never opens", async () => {
  const page = fakePage({ lostClicks: 99 });
  await assert.rejects(() => openEstimateCustomEntry(page), /editor timeout/);
  assert.equal(page.state.clicks, 3);
});
