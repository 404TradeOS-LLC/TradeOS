# TradeOS Signature Motion System

## Purpose

Motion exists to communicate system intelligence and state change, not to decorate routine UI.

Animate when TradeOS is:

1. **UNDERSTANDING**
2. **CONNECTING**
3. **CHANGING**
4. **COMPLETING**

If none of those is happening, the default is static UI.

## Design authority inspected in this pass

The canonical Figma master exposes these motion-oriented component groups on the returned Components surface:

- `Motion / Lifecycle Line`
- `Motion / Price Delta`
- `Motion / Change Diff`
- `Motion / Connection Line`

The Lifecycle Line documentation in Figma states:

- it is contextual lifecycle, not navigation
- advance only on acknowledged state
- blocked/changed labels remain visible
- state duration token: 240 ms
- signature motion ceiling: 640 ms
- reduced-motion duration: 100 ms

The live motion export returned an explicit animation only for the Connection Line's `Copper datum` node (`563:2542`):

- `scaleX: [0.1, 1, 1]`
- duration: 2 seconds
- key times: `[0, 0.14, 1]`
- easing: `easeOut`, then `linear`
- repeating in the Figma prototype

Treat that loop as prototype motion evidence, not blanket permission for perpetual production animation. Production motion must be bound to a real system event or active process.

## Semantic motion classes

### UNDERSTANDING

Use when Athena or another system layer is actively turning unstructured input into structured meaning.

Eligible examples:

- rough scope → structured interpretation
- image/measurement processing when the product truly supports it
- resolving Costbook/Assembly matches from real inputs

Motion purpose:

- show that TradeOS is working on the submitted input
- connect source input to resulting structured output
- end in a stable review state

Do not:

- use fake typing
- stream fabricated intermediate facts
- loop indefinitely after the operation is complete
- imply persistence

### CONNECTING

Use when TradeOS is establishing or revealing a meaningful relationship between real records/data sources.

Eligible examples:

- scope → Costbook/Assembly match
- supplier evidence → Material record
- estimate → proposal
- proposal → job
- field completion → invoice-ready handoff

Motion purpose:

- visually show the relationship being established
- make the source and destination legible
- stop once the connection is acknowledged

### CHANGING

Use when a meaningful value or lifecycle fact changes.

Eligible examples:

- quantity changed → price changed
- supplier/source changed → cost changed
- job status changed
- change order changes contract/billing visibility according to implemented rules

Motion purpose:

- preserve previous/current relationship
- draw attention to the delta, not the entire screen
- keep the reason/source visible when available

### COMPLETING

Use only after a real operation is acknowledged.

Eligible examples:

- estimate saved
- proposal created
- contract signature acknowledged
- payment record successfully persisted
- job completion transition acknowledged

Motion purpose:

- close the interaction
- confirm the state transition
- yield quickly to the next actionable state

Never show completion motion on click alone.

## Motion primitives

### Lifecycle Line

Use for contextual lifecycle orientation only.

Rules:

- not clickable navigation unless a separate navigation affordance exists
- current state is visually distinct
- prior acknowledged states may read as completed
- future states stay quiet
- blocked/changed state remains explicit
- advance only after backend acknowledgement

Use the Figma state token (240 ms) for ordinary state transition where implementation data is available. Reduced motion uses the Figma reduced token (100 ms).

### Price Delta

Use when a reviewed input causes a material price change.

Required content around the animation:

- previous value
- current value
- changed input/source
- unresolved state when the recalculation fails

Do not animate a price merely because the user navigated to the Price stage.

### Change Diff

Use when the system needs to preserve before/after understanding.

Required:

- previous
- current
- reason/source where available

The animation cannot replace readable text.

### Connection Line

Use only while a real connection/resolution is active.

The exported Figma prototype contains a repeating 2-second `scaleX` sequence for the copper datum. Before production use, bind the effect to a real active process and stop it when that process resolves. Do not introduce a permanent ambient loop.

## Entry / boot motion

The entry experience may use signature motion only for real initialization steps such as:

- authenticating session
- resolving organization context
- loading actionable Today state

The UI must not invent subsystem checks or claim a system is connected when no corresponding runtime evidence exists.

## Routine UI that should remain mostly static

Do not add signature motion to:

- ordinary nav changes
- every card hover
- table row hover
- every badge/status chip
- scrolling
- opening every basic form field
- decorative copper lines with no state meaning

Menus/sheets/dialogs may retain normal interaction transitions required for usability; those are not signature intelligence motion.

## Accessibility

Every implementation must honor `prefers-reduced-motion`.

For reduced motion:

- preserve state visibility
- remove nonessential travel, scaling, and looping
- prefer immediate/short fades or direct state swap
- use the documented reduced token where the Figma component specifies it
- never require motion to understand success, failure, source, or delta

## Current production motion seam

Current `web/package.json` already includes `framer-motion` (`^13.4.4`). Production also has a global `prefers-reduced-motion` override in `web/src/app/globals.css`, `use-count-up.ts` explicitly checks the media query, and the existing Control Dock attention pulse documents reduced-motion behavior.

Therefore:

- do not add a second animation library for signature motion;
- prefer the existing Framer Motion seam for stateful JavaScript motion and existing CSS transitions/keyframes for simple interaction motion;
- keep the current global reduced-motion protections intact and add component-level reduced behavior when the signature sequence needs it;
- reuse existing attention-motion conventions rather than inventing a competing pulse/glow language.

## Implementation policy

- Reuse the project's current Framer Motion/CSS stack.
- Do not add a motion dependency merely to animate one small state.
- Use canonical tokens and components.
- Keep animation values sourced from Figma motion data when it exists.
- If Figma returns no motion track for a component, do not fabricate exact timing/easing and call it canonical.
- Validate one motion end to end before applying a pattern broadly.

## Acceptance criteria

A motion implementation is ready only when:

- it corresponds to understanding, connecting, changing, or completing
- its trigger is a real application state
- it stops when the state resolves
- reduced-motion behavior is implemented
- it does not imply persistence/success before acknowledgement
- labels/data remain understandable without motion
- mobile performance remains acceptable
- rendered evidence shows the actual event sequence

## Next five TODO items

1. Reconcile the live Figma page-enumeration discrepancy before any broad motion write.
2. Map Lifecycle Line to the real project/proposal/job/invoice lifecycle surfaces that already exist.
3. Implement one bounded motion proof first, preferably a non-financial read-only lifecycle or estimate interpretation state.
4. Verify reduced motion and event acknowledgement before expanding to Price Delta/Change Diff.
5. Capture exact-head browser evidence and document any Figma motion nodes that cannot be represented faithfully in the current frontend stack.
