# TradeOS Code Connect templates (unpublished)

These parserless `.figma.ts` files connect **published TradeOS product design-system components** to the existing React/TypeScript source. They are separate from the Athena-specific, currently unapproved draft screen designs.

| Design-system component | Figma node | Production React component | Mapping |
| --- | --- | --- | --- |
| Button | [10:57](https://www.figma.com/design/xImUa9CYUjx3Cb3zTrkfnY?node-id=10-57) | `web/src/components/ui/button.tsx` → `Button` | Six variants, four sizes, label (MD → production default size) |
| Textarea | [175:17](https://www.figma.com/design/xImUa9CYUjx3Cb3zTrkfnY?node-id=175-17) | `web/src/components/ui/textarea.tsx` → `Textarea` | Four states, text placeholder (Focused is design-only, Disabled → disabled, Error → aria-invalid) |

**Verification:** Figma component property metadata and actual checked-in React sources were inspected November 19, 2026. `get_code_connect_suggestions` identified both as unmapped in the Athena-first review screens. This commit **does not** publish Code Connect. The server-side Figma mapping currently remains empty.

**Publishing prerequisites:** A Figma Code Connect eligible seat/team and a scoped, authorized CLI token are needed. Confirm plan and permissions and review the generated snippets first. This repository does **not** install the Code Connect CLI, run `figma connect publish`, or store any token. Avoid adding the template source files to the Web TypeScript application build; they live outside `web/` deliberately.

**Independent verification before publishing:** install the Code Connect CLI in a safe tool environment and run `npx figma connect preview` against root `figma.config.json` to inspect the rendered snippets as they would appear in Dev Mode — the CLI validates JSX/TSX snippets with Prettier and surfaces syntax errors before anything ships. Cover every variant combination with `npx figma connect preview <template> --all`, including Disabled/Error and keyboard state, then publish only with appropriate authorization. Snippets appear in Figma Dev Mode only after publication, so Dev Mode inspection is a post-publication check, not a pre-publication gate: publish under a temporary label to test in Figma, then unpublish. See the [Figma Code Connect CLI quickstart](https://developers.figma.com/docs/code-connect/quickstart-guide/) and [CLI reference](https://developers.figma.com/docs/code-connect/cli-reference/) (`preview`).

Do **not** infer that:
- A Code Connect snippet implements Athena's chat-to-estimate flow.
- Figma `Focused` implies the application should auto-focus a form field.
- The local Athena note-header, Queue row and Control Dock have verified production React counterparts or have been published.
- New canonical Today designs have been approved.

The [Athena-first Figma-to-React mapping matrix](../../docs/architecture/ATHENA_FIRST_FIGMA_TO_CODE_MAPPING.md) and [draft PR #1009](https://github.com/404TradeOS-LLC/TradeOS/pull/1009) remain the release handoff.
