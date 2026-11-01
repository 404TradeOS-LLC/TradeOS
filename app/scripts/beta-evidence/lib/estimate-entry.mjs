// Reused by canonical certification and isolated UI tests. Older workbenches
// expose the editor directly; focused Items requires its explicit disclosure.
//
// The disclosure click can be lost when the Items stage is still settling
// (remount or stage transition between the click and the panel render), which
// used to surface as a blind 15s wait on a hidden input. So: wait for the
// button to actually be VISIBLE before acting, and after each click verify
// the panel opened — retrying the click when it did not — instead of
// trusting a single aria-expanded read.
export async function openEstimateCustomEntry(page) {
  const action = page.getByRole("button", { name: "Custom item", exact: true });
  const editor = page.getByLabel("Custom line item", { exact: true });
  if ((await action.count()) === 0) {
    // Older workbenches expose the editor directly; no disclosure to open.
    await editor.waitFor({ state: "visible", timeout: 15_000 });
    return editor;
  }
  // Presence in the DOM is not enough: the Items section itself can still be
  // hidden while the stage transition settles.
  await action.waitFor({ state: "visible", timeout: 30_000 });
  for (let attempt = 0; attempt < 3; attempt++) {
    if ((await action.getAttribute("aria-expanded")) !== "true") await action.click();
    try {
      await editor.waitFor({ state: "visible", timeout: 5_000 });
      return editor;
    } catch {
      // Click lost to a remount or stage transition; retry while attempts remain.
    }
  }
  // Panel never opened: surface the genuine failure instead of swallowing it.
  await editor.waitFor({ state: "visible", timeout: 15_000 });
  return editor;
}
