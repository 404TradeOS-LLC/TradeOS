# TradeOS Product Design Contract

**Status:** Canonical visual and interaction-intent guidance for TradeOS product UI.

**Authority model:**

1. Governed product and architecture source-of-truth documents define product scope, supported capabilities, domain contracts, security boundaries, and workflow behavior.
2. The current approved TradeOS Sites direction governs product intent, hierarchy, information architecture, and the desired contractor experience.
3. Current production implementation and tokens govern exact values, accessibility pairings, responsive behavior, and implementation details. In particular, `web/src/app/globals.css` and shared production components are implementation authority.
4. Historical 404 TradeOS / Claude design-system material is reference material only and must not override current product decisions or production-safe values.

If these sources appear to conflict, do not invent a compromise. Preserve product/domain truth, use the approved Sites direction for experience intent, use production code for exact implementation values, and update the relevant governed source in the same change when a deliberate product decision changes it.

---

## 1. Product intent

TradeOS should feel like a **contractor command center**: simple enough to understand at a glance, powerful enough to run a real contracting business, and precise enough to inspire trust.

Core principles:

- **Action before analytics.** Show what needs attention and what to do next before historical metrics.
- **One dominant next move.** Every important screen should make the highest-value next action obvious.
- **Calm under load.** Dense information is acceptable; visual chaos is not.
- **Operational language.** Use direct contractor language rather than marketing copy or generic SaaS jargon.
- **Real data over decoration.** Never fabricate metrics, charts, integrations, engagement signals, or operational states to make a screen look complete.
- **Progressive disclosure.** Reveal detail when needed rather than putting every capability on the first screen.
- **Mobile-first ergonomics.** Primary actions must remain reachable and understandable on a phone.
- **Accessible by construction.** Contrast, focus, motion, touch targets, and semantic state must be intentionally designed.

---

## 2. Visual environments

### Blueprint

Blueprint is the default TradeOS product environment:

- light, cool-graphite surfaces
- clean white and soft neutral cards
- restrained copper accents
- compact, engineered spacing
- strong hierarchy without visual noise
- borders used more often than shadows
- precise, professional typography

### Carbon

Carbon is the product dark mode. It must preserve the same hierarchy, interaction logic, semantic colors, and accessibility quality as Blueprint rather than becoming a separate aesthetic concept.

### Forge

Forge is the darker, warmer, dramatic 404 TradeOS marketing language. Keep it on marketing and brand-storytelling surfaces. Normal product workflows must not drift into Forge styling simply because copper and dark surfaces are available.

---

## 3. Color and token rules

**TradeOS Copper — `#B87333`** is the brand accent, not a general-purpose semantic color.

Use copper sparingly for primary actions, active navigation, selected controls, focus treatment where the production pairing is accessible, and restrained brand moments.

Semantic colors retain semantic meaning:

- green = success / complete / healthy / online
- amber = warning / caution / attention needed
- red = destructive / failed / genuinely critical
- blue = informational / neutral system state
- copper = brand / primary interaction

Do not create a rainbow dashboard by assigning arbitrary colors to sections.

Exact color values, foreground pairings, focus rings, and dark-mode tokens come from current production code. Accessibility-corrected production values override historical design-bundle values.

---

## 4. Typography

Use **Space Grotesk** for page and section headings and selected numerical display moments. Use the product/system sans stack for body text, controls, navigation, form labels, and normal UI copy. Use monospaced text only where alignment or machine-like precision improves scanning, such as IDs, timestamps, measurements, and dense numeric tables.

A normal screen should have one page-level title, one primary operational message or next action, clear section labels, and compact supporting text. Avoid multiple equally loud headlines.

---

## 5. Layout and density

TradeOS is an operational product. Prefer dense-but-readable layouts over marketing-scale whitespace.

Cards should group meaningful information rather than become the default container for every datum. Prefer ranked lists, compact rows, grouped sections, inline actions, and expandable detail. Avoid walls of identical rounded cards.

Use borders for most separation. Reserve stronger shadows for floating menus, sheets, popovers, dialogs, and temporary overlays. Use restrained corner radii; pill shapes should be semantically justified.

---

## 6. Mobile-first contractor ergonomics

- Use practical touch targets around 44 px or larger.
- Keep frequent actions thumb-reachable.
- Do not squeeze desktop tables into unreadable mobile layouts.
- Prefer stacked rows, disclosure panels, and dedicated mobile representations.
- Persistent bottom navigation is appropriate for a small set of highest-frequency destinations.
- Keep one dominant primary action visible when it materially improves completion of the current task.
- Secondary modules belong behind More/Menu or contextual navigation rather than overcrowding bottom navigation.

---

## 7. Dashboard / owner command center

The dashboard is the owner's daily command center, not a widget collection.

It should answer, in order:

1. What is happening today?
2. What needs my attention?
3. What should I do next?
4. Where are today's job, crew, schedule, or money risks?

The top zone may show today's schedule summary, urgent operational count, overdue or ready-to-collect money, and one dominant CTA such as **Handle next priority**.

### Needs-attention queue

Use a single ranked queue rather than several unrelated attention cards. Rank by consequence if ignored. Every row should, where the underlying product capability exists, communicate:

- what happened
- why it matters
- recommended resolution
- direct action

Do not invent unsupported queue types, telemetry, integrations, or risk signals.

### Schedule and financial context

Schedule rows should be easy to scan for time, customer/job, assignee, location/context, status, and real problem indicators. Unassigned work should be visibly distinct.

Favor operational money signals such as overdue amount, ready-to-invoice amount, and recently collected or due payments when actionable. Do not prioritize vanity charts above urgent work.

---

## 8. Athena design language

Athena is an **embedded operational intelligence layer**, not a generic chatbot attached to TradeOS.

A useful Athena recommendation should communicate:

1. **Recommendation** — what should happen.
2. **Reason** — the verified evidence that caused it to surface.
3. **Consequence** — what may happen if ignored, when supported.
4. **Action** — a direct way to resolve or advance the item.

Example using verifiable lifecycle data:

> Follow up with Briarwood Condo  
> Proposal was viewed on September 9 and has remained open for 5 days.  
> **Send follow-up** · **Review proposal**

Do not describe “high engagement,” intent, sentiment, risk, or other inferred states as confirmed facts unless the product has a real data contract that supports those claims.

Athena should visually distinguish observation, recommendation, prepared action, executed action, and uncertainty/missing data. Never present AI assumptions as confirmed live business data.

Use contextual recommendation panels, inline suggestion rows, task-preparation sheets, or a compact assistant drawer when conversation is necessary. Avoid making a floating chatbot bubble the primary Athena experience.

---

## 9. Sign-in and entry experience

The TradeOS sign-in experience must be unmistakably TradeOS:

- real TradeOS logo/mark
- Blueprint product environment
- restrained copper branding
- contractor-focused plain-language message
- minimal distractions
- clear form hierarchy
- excellent mobile behavior

Do not use unrelated art, generic pixel art, stock SaaS illustrations, or marketing-page complexity.

---

## 10. Components

### Buttons

Use copper-filled primary buttons only for the single highest-priority action in context, using the current production-accessible foreground pairing. Secondary buttons must be visually subordinate. Destructive styling is reserved for genuinely destructive actions.

### Status badges

Badges indicate compact status. Color must match meaning, and state should not rely on color alone when text or iconography can clarify it.

### Forms

Use clear labels, visible focus treatment, concise help text, inline validation near the relevant field, and requirements that are visible before submission.

### Tables and dense data

Use strong row rhythm, aligned values, sticky headers where useful, touch-capable controls, and thoughtful mobile transformation.

### Drawers, sheets, and dialogs

Use contextual surfaces for work that does not deserve full navigation. Avoid modal-on-modal stacks.

### Empty states

An empty state should explain what the area is, why it is empty when known, and the best next action. Do not leave operational screens as blank cards with only “No data.”

---

## 11. Motion and loading

Motion must explain state change, progress, hierarchy, or continuity rather than decorate the interface. Respect `prefers-reduced-motion`.

TradeOS-specific loading motifs may include a subtle saw-blade/cut-progress treatment, TradeOS mark reveal, mechanical progress sweep, or restrained scan/radar motion when the system is genuinely searching, analyzing, or locating something.

Do not show a dramatic loader when content can render immediately, and do not use a standing decorative radar widget.

---

## 12. Maps and dispatch

When crew location or dispatch mapping is supported, treat the map as an operational tool. Prioritize current job context, assigned crew, route/status relevance, freshness/staleness of location data, and useful mobile interaction. Do not imply live crew location unless the product has current location data.

---

## 13. Accessibility

Every product screen must account for:

- WCAG-compliant contrast
- visible focus states
- keyboard navigation where applicable
- practical mobile touch targets
- reduced-motion support
- readable type sizes
- semantic state not communicated by color alone
- clear error and recovery messaging

Production accessibility fixes and current token pairings are authoritative for exact implementation values.

---

## 14. Content and voice

Prefer plain operational language such as:

- “3 things need you today”
- “2 jobs are unassigned”
- “Invoice is 8 days overdue”
- “Send follow-up”
- “Handle next priority”

Avoid marketing slogans inside workflow screens, vague AI claims, corporate jargon, cute copy around money/scheduling/risk, and assertions unsupported by current product data.

---

## 15. Anti-patterns — do not ship

Do not ship:

- a wall of equal-weight cards
- rainbow section colors
- gradients everywhere
- glassmorphism as the default surface treatment
- excessive pill-shaped UI
- decorative charts above urgent work
- fake data presented as real
- dead buttons
- unsupported integrations presented as live
- blank operational screens
- generic chatbot styling for Athena
- Forge marketing styling across normal product screens
- standing decorative radar widgets
- modal-on-modal interaction stacks
- oversized desktop whitespace in dense contractor workflows
- primary actions that move unpredictably between similar screens
- multiple equally dominant CTAs

When in doubt, cut rather than add.

---

## 16. Screen-level checklist

Before approving a TradeOS screen, verify:

- [ ] The screen has one obvious purpose.
- [ ] The most important action is visually dominant.
- [ ] Blueprint is used for normal product UI.
- [ ] Copper is restrained and intentional.
- [ ] Semantic colors match semantic meaning.
- [ ] The layout works on a phone without desktop compression.
- [ ] Touch targets are practical.
- [ ] Empty/loading/error states are designed.
- [ ] Athena, if present, explains why and distinguishes evidence from inference.
- [ ] Real operational information outranks decorative analytics.
- [ ] No unsupported capability or telemetry is implied.
- [ ] Motion is purposeful and reduced-motion-safe.
- [ ] Accessibility contrast and focus behavior are verified against production tokens.
- [ ] The result looks recognizably TradeOS rather than generic SaaS.

---

## 17. Implementation and conflict resolution

This document governs visual and interaction intent. It does **not** create new product capabilities, data contracts, schema, permissions, integrations, or workflow truth.

Before implementing UI from this document:

1. Read the relevant governed product/module source-of-truth documents for capability and behavior.
2. Inspect current production components and tokens.
3. Preserve the approved command-center direction.
4. Reuse existing components when they satisfy the intent.
5. Do not invent data or backend behavior to complete a mockup.
6. If a deliberate design decision requires product or implementation truth to change, update the affected source-of-truth documentation and implementation together rather than silently diverging.

The target is a TradeOS experience that feels **simple on the surface, intelligent underneath, and unmistakably built for contractors**.
