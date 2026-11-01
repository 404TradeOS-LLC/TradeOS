import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("./page.tsx", import.meta.url);

test("empty task creation explains Project prerequisite and provides a real creation route", async () => {
  const source = await readFile(pageUrl, "utf8");
  assert.match(source, /intent === "task" \? \(\s*<Link href="\/projects\/new\?intent=task"/);
  assert.match(source, /Create a project for tasks/);
  assert.match(source, /Tasks belong to a Project\. Create a Project, then TradeOS will open its task form/);
});
