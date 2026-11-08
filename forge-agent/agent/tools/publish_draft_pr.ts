import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { createDraft } from "../../lib/github-client.js";

export default defineTool({
  description: "Publish a draft-only pilot PR changing at most four docs/forge Markdown files for a forge:ready issue with exact-main SHA. Disabled unless a scoped repository token and owner enablement are configured; never merges.",
  // An authorized human must approve each side-effecting PR creation.
  // The default-disabled write flag, scoped token, issue label, file policy,
  // and exact-main preflight remain independent safeguards.
  approval: always(),
  inputSchema: z.object({
    issueNumber: z.number().int().positive(),
    baseSha: z.string().regex(/^[a-f0-9]{40}$/),
    files: z.array(z.object({
      path: z.string(),
      content: z.string(),
    })).min(1).max(4),
  }),
  async execute(input) {
    return createDraft(input);
  },
});
