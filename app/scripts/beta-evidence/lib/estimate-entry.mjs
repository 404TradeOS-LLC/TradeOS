// Reused by canonical certification and isolated UI tests. Older workbenches
// expose the editor directly; focused Items requires its explicit disclosure.
//
// The disclosure click can be lost when the Items stage is still settling
// (remount or stage transition between the click and the panel render), which
// used to surface as a blind 15s wait on a hidden input. So: wait for the
// button to actually be VISIBLE before acting, and after each click verify
// the panel opened — retrying the click when it did not — instead of
// trusting a single aria-expanded read.
//
// Separately, the button may not exist yet while the builder's async query
// is still loading: an instant count() === 0 misclassifies a still-loading
// focused workbench as an old direct-editor workbench and drops into a blind
// editor wait. Poll briefly for the button; only if it never appears do we
// take the direct-editor path.
export async function openEstimateCustomEntry(page) {
  const action = page.getByRole("button", { name: "Custom item", exact: true });
  const editor = page.getByLabel("Custom line item", { exact: true });
  const deadline = Date.now() + 15_000;
  let buttonCount = await action.count();
  while (buttonCount === 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    buttonCount = await action.count();
  }
  if (buttonCount === 0) {
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
