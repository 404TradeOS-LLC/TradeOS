export interface ChangelogEntry {
  /** Stable id, also used as the "seen" watermark - bump it when adding a new entry. */
  id: string;
  date: string;
  items: string[];
}

// Contractor-facing summaries of real shipped changes, newest first - never
// invented copy. Add a new entry (with a new id) when the next batch of
// user-visible changes ships; don't edit past entries after the fact.
export const CHANGELOG: ChangelogEntry[] = [
  {
    id: "2026-09-08-polish",
    date: "September 2026",
    items: [
      "A Light/Dark/System appearance toggle in the menu",
      "Breadcrumbs back to the project on estimate, invoice, proposal, and contract pages",
      "A clearer, more visible keyboard focus outline",
      "Sticky column headers on long Costbook and Dispatch lists",
      "A worked example on the estimate markup/margin toggle",
      "A printable, clean layout for invoices, proposals, and contracts",
      "A \"?\" shortcut for a keyboard shortcuts reference",
    ],
  },
  {
    id: "2026-09-04-control-dock",
    date: "September 2026",
    items: [
      "Restored the copper brand color across the app",
      "A new bottom Control Dock for quick access to Today, Dispatch, Create, Work, and More on mobile",
    ],
  },
];

export const LATEST_CHANGELOG_ID = CHANGELOG[0]?.id ?? "";
