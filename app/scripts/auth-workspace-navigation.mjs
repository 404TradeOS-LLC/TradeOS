/** Use the same responsive account controls as a contractor. */
export async function signOutOfWorkspace(page) {
  const signOut = page.getByRole("button", { name: "Sign out", exact: true });
  if (!(await signOut.first().isVisible())) {
    await page.getByRole("button", { name: "Open more menu", exact: true }).click();
  }
  await signOut.filter({ visible: true }).first().click();
}
