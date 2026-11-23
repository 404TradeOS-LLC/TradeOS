import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path: string): Promise<string> {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("BottomSheet is the shared production sheet, promoted from the AppNav sheets", async () => {
  const sheet = await readSource("../../../../../../../components/ui/bottom-sheet.tsx");

  // DESIGN.md §11 Bottom Sheet contract: safe-area padding, body-scroll lock,
  // backdrop close, Escape close, focus trap, focus restoration.
  assert.match(sheet, /role="dialog"/);
  assert.match(sheet, /aria-modal="true"/);
  assert.match(sheet, /aria-label=\{label\}/);
  assert.match(sheet, /aria-label=\{closeLabel\}/);
  assert.match(sheet, /onClick=\{onClose\}/);
  assert.match(sheet, /useBodyScrollLock\(true\)/);
  assert.match(sheet, /event\.key === "Escape"/);
  assert.match(sheet, /event\.key !== "Tab"/);
  assert.match(sheet, /querySelectorAll<HTMLElement>\(/);
  assert.match(sheet, /previouslyFocused\?\.isConnected/);
  assert.match(sheet, /returnFocusRef\?\.current/);
  // Drag handle + safe-area bottom padding + slide-in, as drawn in AppNav.
  assert.match(sheet, /mx-auto mb-4 h-1\.5 w-10 rounded-full bg-border/);
  assert.match(sheet, /pb-\[calc\(env\(safe-area-inset-bottom\)\+6rem\)\]/);
  assert.match(sheet, /animate-in slide-in-from-bottom/);
  // Geometry is caller-overridable through panelClassName (tailwind-merge).
  assert.match(sheet, /panelClassName\?: string/);
  assert.match(sheet, /cn\(\n?\s*"absolute inset-x-0 bottom-0/);
  assert.match(sheet, /panelClassName\s*\n?\s*\)/);
  assert.doesNotMatch(sheet, /clientFetch\(|fetch\(/);
});

test("AppNav Create and More sheets are BottomSheet instances, not duplicated dialogs", async () => {
  const nav = await readSource("../../../../../../../components/shared/app-nav.tsx");

  assert.match(nav, /import \{ BottomSheet \} from "@\/components\/ui\/bottom-sheet";/);
  assert.match(nav, /label="Create"/);
  assert.match(nav, /closeLabel="Close create menu"/);
  assert.match(nav, /label="More navigation"/);
  assert.match(nav, /closeLabel="Close more menu"/);
  assert.match(nav, /returnFocusRef=\{createButtonRef\}/);
  assert.match(nav, /returnFocusRef=\{dockMoreButtonRef\}/);
  // The More sheet keeps its shorter max height; the Create sheet keeps the
  // shared default. Both keep the centered desktop panel geometry.
  assert.match(nav, /panelClassName="max-h-\[75dvh\] sm:left-1\/2 sm:right-auto sm:w-\[min\(42rem,calc\(100%_-_2rem\)\)\] sm:-translate-x-1\/2"/);
  assert.match(nav, /panelClassName="sm:left-1\/2 sm:right-auto sm:w-\[min\(42rem,calc\(100%_-_2rem\)\)\] sm:-translate-x-1\/2"/);
  // No duplicated inline sheet: no local sheet refs, no local trap effects,
  // no inline dialog markup, no direct scroll-lock call in AppNav.
  assert.doesNotMatch(nav, /sheetRef|createSheetRef/);
  assert.doesNotMatch(nav, /useBodyScrollLock/);
  assert.doesNotMatch(nav, /role="dialog"/);
  assert.doesNotMatch(nav, /aria-modal="true"/);
  // History navigation still closes both sheets.
  assert.match(nav, /closeSheetOnHistoryNavigation/);
  assert.match(nav, /window\.addEventListener\("popstate", closeSheetOnHistoryNavigation\)/);
});

test("job Athena mobile sheet renders the Figma 289:165 chrome around the compact workspace", async () => {
  const sheet = await readSource("./job-athena-sheet.tsx");

  assert.match(sheet, /import \{ BottomSheet \} from "@\/components\/ui\/bottom-sheet";/);
  assert.match(sheet, /import \{ JobAthenaWorkspace \} from "\.\/job-athena-workspace";/);
  // Floating-card geometry: 8px side margins, below the app header, ending
  // above the Control Dock — the product bar and dock stay visible around it.
  assert.match(sheet, /panelClassName="inset-x-2 top-28 bottom-\[calc\(4\.5rem\+env\(safe-area-inset-bottom\)\)\] max-h-none rounded-2xl border pb-4"/);
  // Header per the frame: "Athena" + Job scoped badge + job identity line.
  assert.match(sheet, />Athena<\/h2>/);
  assert.match(sheet, /<Badge variant="outline">Job scoped<\/Badge>/);
  assert.match(sheet, /\{jobTitle\} · \{jobNumber\} · \{formatStatusLabel\(jobStatus\)\}/);
  assert.match(sheet, /import \{ formatStatusLabel \} from "@\/components\/shared\/status-badge";/);
  // Content is the existing job workspace in compact form, composer pinned
  // to the sheet's bottom. The Confirm Write card renders inside it
  // unchanged; the sheet adds no fetch and no new write path.
  assert.match(sheet, /<JobAthenaWorkspace/);
  assert.match(sheet, /compact/);
  assert.match(sheet, /stickyComposer/);
  assert.doesNotMatch(sheet, /clientFetch\(|fetch\(/);
  assert.doesNotMatch(sheet, /\/api\/v1\//);
  // Closing returns to the job page, the route's parent.
  assert.match(sheet, /router\.push\(`\/projects\/\$\{projectId\}\/jobs\/\$\{jobId\}`\)/);
  assert.match(sheet, />\s*Close\s*<\/button>/);
});

test("job Athena route shows the sheet at phone widths and the desktop route at md and up", async () => {
  const routePage = await readSource("./page.tsx");

  assert.match(routePage, /import \{ JobAthenaSheet \} from "\.\/job-athena-sheet";/);
  // Desktop presentation is hidden below md; the sheet owns its own
  // breakpoint (see the viewport gate test below) — the route must not hide
  // it with CSS alone, which would leave its scroll lock and keyboard
  // handling mounted on desktop. Both receive the same scope, so the sheet
  // is the same workspace, not a second one.
  assert.match(routePage, /<div className="mx-auto hidden w-full max-w-5xl flex-col gap-5 md:flex">/);
  assert.doesNotMatch(routePage, /<div className="md:hidden">/);
  assert.match(routePage, /<JobAthenaSheet/);
  assert.match(routePage, /jobStatus=\{job\.status\}/);
  assert.match(routePage, /estimateId=\{approved\?\.estimateId \?\? undefined\}/);
  // The kernel-disabled branch is untouched: no sheet when Athena is off.
  assert.match(routePage, /Athena isn't enabled for this workspace yet/);
  // DES-4 gating is unchanged: the sheet renders only after the server-side
  // role check passes.
  assert.match(routePage, /canUseJobAthena/);
  assert.doesNotMatch(routePage, /getAthenaOperatorContext|getAthenaObservabilityOverview/);
});

test("sheet mounts only at phone widths (viewport gate)", async () => {
  // Regression for a real Codex P1 on PR #1029: `md:hidden` hides the
  // sheet visually but leaves it mounted, so its scroll lock and
  // Tab/Escape handling broke the desktop workspace. The sheet must
  // return null above the breakpoint so unmounting releases those effects.
  const sheet = await readSource("./job-athena-sheet.tsx");
  const hook = await readSource("../../../../../../../hooks/use-media-query.ts");

  assert.match(sheet, /import \{ useMediaQuery \} from "@\/hooks\/use-media-query";/);
  assert.match(sheet, /useMediaQuery\("\(max-width: 767px\)"\)/);
  assert.match(sheet, /if \(!isPhoneViewport\) return null;/);
  assert.match(hook, /useState\(false\)/);
  assert.match(hook, /window\.matchMedia\(query\)/);
  assert.match(hook, /addEventListener\("change", update\)/);
  assert.match(hook, /removeEventListener\("change", update\)/);
});

test("Athena workspace supports a sheet-pinned composer and the job placeholder", async () => {
  const workspace = await readSource("../../../../../../../components/athena/athena-workspace.tsx");
  const wrapper = await readSource("./job-athena-workspace.tsx");

  assert.match(workspace, /stickyComposer\?: boolean/);
  assert.match(workspace, /compact && stickyComposer && "sticky bottom-0 backdrop-blur"/);
  assert.match(workspace, /composerPlaceholder\?: string/);
  assert.match(workspace, /placeholder=\{composerPlaceholder \?\? \(selectedScope/);
  // The desktop composer is unchanged: still pinned above the dock.
  assert.match(workspace, /sticky bottom-\[calc\(4\.5rem\+env\(safe-area-inset-bottom\)\)\] backdrop-blur 2xl:bottom-0/);

  // The job wrapper passes the sheet props through and uses the frame's
  // composer copy on both presentations.
  assert.match(wrapper, /compact\?: boolean/);
  assert.match(wrapper, /stickyComposer\?: boolean/);
  assert.match(wrapper, /compact=\{compact\}/);
  assert.match(wrapper, /stickyComposer=\{stickyComposer\}/);
  assert.match(wrapper, /composerPlaceholder="Ask about this job…"/);
});

test("status labels are one shared helper for the badge and the sheet subtitle", async () => {
  const badge = await readSource("../../../../../../../components/shared/status-badge.tsx");

  assert.match(badge, /export function formatStatusLabel\(status: string\): string/);
  assert.match(badge, /STATUS_LABELS\[normalizedStatus\]/);
  assert.match(badge, /\{formatStatusLabel\(status\)\}/);
  // The badge no longer relies on CSS capitalization for its fallback text.
  assert.doesNotMatch(badge, /capitalize/);
});
