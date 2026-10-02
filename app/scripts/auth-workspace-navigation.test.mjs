import assert from "node:assert/strict";
import test from "node:test";
import { signOutOfWorkspace } from "./auth-workspace-navigation.mjs";

function workspace(wide) {
  let menuOpen = false;
  const actions = [];
  const visible = () => wide || menuOpen;
  const signOut = {
    first: () => ({ isVisible: async () => wide }),
    filter: ({ visible: onlyVisible }) => {
      assert.equal(onlyVisible, true);
      return { first: () => ({ click: async () => {
        assert.equal(visible(), true, "sign out must be exposed before clicking");
        actions.push("logout");
      } }) };
    },
  };
  return {
    actions,
    getByRole: (role, { name }) => {
      assert.equal(role, "button");
      if (name === "Sign out") return signOut;
      assert.equal(name, "Open more menu");
      return { click: async () => { assert.equal(wide, false); menuOpen = true; actions.push("open menu"); } };
    },
  };
}

test("logout uses the directly visible desktop account control", async () => {
  const page = workspace(true);
  await signOutOfWorkspace(page);
  assert.deepEqual(page.actions, ["logout"]);
});

test("logout opens More when the responsive dock hides account controls", async () => {
  const page = workspace(false);
  await signOutOfWorkspace(page);
  assert.deepEqual(page.actions, ["open menu", "logout"]);
});
