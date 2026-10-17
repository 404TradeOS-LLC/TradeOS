// Reused by canonical certification and isolated UI tests. Older workbenches
// expose the editor directly; focused Items requires its explicit disclosure.
export async function openEstimateCustomEntry(page) {
  const action = page.getByRole("button", { name: "Custom item", exact: true });
  if (await action.count() > 0 && await action.getAttribute("aria-expanded") !== "true") await action.click();
  const editor = page.getByLabel("Custom line item", { exact: true });
  await editor.waitFor({ state: "visible", timeout: 15_000 });
  return editor;
}
