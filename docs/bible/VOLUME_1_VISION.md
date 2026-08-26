---
status: current
owner: founder
last_verified: 2026-07-16
source_of_truth: true
related_docs:
  - docs/PRODUCT_SCOPE.md
  - docs/product/TRADEOS_OWNER_EXPERIENCE.md
  - docs/product/TRADEOS_UX_ADVANTAGES.md
  - docs/research/CONTRACTOR_UX_RESEARCH.md
  - docs/ROADMAP.md
---

# TradeOS Bible — Volume 1: Vision

## 1. Purpose of this volume

This volume defines why TradeOS exists, who it serves, how it should feel, and which principles must remain stable as implementation changes.

It is not a feature list. It is the product doctrine used to decide:

- which customers TradeOS is built for first;
- which problems deserve engineering investment;
- what the product should make users feel;
- where AI should assist and where it must stop;
- how TradeOS should differ from entry-level and enterprise competitors;
- which ideas belong in the active roadmap;
- which ideas should be deferred, rejected, or explicitly excluded.

When another document, implementation shortcut, feature request, or agent-generated plan conflicts with this volume, the conflict must be surfaced rather than silently resolved.

## 2. The mission

TradeOS exists to give trade contractors a practical operating system that is powerful enough to replace fragmented tools without becoming as expensive, slow, or complicated as enterprise field-service platforms.

The product should help contractors run a more organized, more profitable, and more trustworthy business without forcing them to become software experts.

TradeOS should convert scattered operational information into clear decisions and reviewable actions.

## 3. The long-term vision

TradeOS becomes the daily operating layer for a contractor business.

It should be the place where the company understands:

- who its customers are;
- what work has been requested;
- what work has been estimated;
- what has been approved;
- what must be scheduled;
- who is responsible;
- what is happening in the field;
- what is blocked or at risk;
- what is ready to invoice;
- what money is outstanding;
- what the customer sees;
- what action should happen next.

The long-term product is not merely a collection of forms and records. It is a coordinated operating system that preserves context across the full lifecycle of work.

## 4. The customer TradeOS serves first

### 4.1 Primary segment

The initial target is the growing trade contractor with approximately 5–30 technicians who:

- has outgrown spreadsheets, text messages, paper folders, and entry-level tools;
- needs stronger estimating, scheduling, and operational visibility;
- cannot justify enterprise pricing or implementation burden;
- does not have a dedicated internal software or data team;
- needs software that improves the business quickly rather than becoming another project to manage.

### 4.2 Primary decision-maker

The initial economic buyer is usually the owner, operator, general manager, or operations leader.

This person often carries several responsibilities at once:

- sales;
- estimating;
- dispatch oversight;
- financial review;
- hiring and field accountability;
- customer escalations;
- quality control;
- day-to-day problem solving.

TradeOS must respect that this user is interrupted constantly and rarely has time for long software workflows.

### 4.3 Important secondary users

TradeOS must also serve:

- dispatchers coordinating schedules and technician assignments;
- estimators building scopes and pricing work;
- office staff managing customers, documents, invoices, and follow-up;
- technicians receiving assignments and updating field status;
- customers reviewing proposals, contracts, invoices, and project information.

The owner remains the first design anchor, but the product must create a coherent experience across these roles.

### 4.4 Trade focus

The product should initially serve operationally similar trade businesses such as:

- HVAC;
- plumbing;
- electrical;
- roofing;
- general contracting;
- remodeling;
- specialty construction and service contractors.

Trade-specific depth may expand over time, but the shared operating model must remain coherent.

## 5. The problem TradeOS is solving

Growing contractors commonly operate across disconnected systems:

- customer records in one place;
- estimates in another;
- schedules in a calendar or whiteboard;
- job details in text threads;
- documents in email;
- pricing knowledge in spreadsheets or individual memory;
- invoices in accounting software;
- field updates spread across calls, photos, and notes.

This fragmentation creates predictable failures:

- work falls through the cracks;
- estimates take too long;
- pricing becomes inconsistent;
- dispatch decisions lack context;
- owners discover problems too late;
- customers receive conflicting information;
- completed work waits too long to be invoiced;
- critical knowledge stays trapped in one employee's head;
- software becomes another source of confusion instead of control.

TradeOS exists to reduce these failures by connecting lifecycle data, presenting the right information at the right moment, and preparing the next safe action.

## 6. Jobs to be done

### 6.1 Owner jobs

An owner should be able to use TradeOS to:

- understand the condition of the business quickly;
- identify what needs attention today;
- see which jobs are unscheduled, blocked, late, or financially stalled;
- understand where revenue is waiting;
- approve prepared actions without digging through multiple systems;
- trust that important work is not disappearing between departments;
- step away from daily operations without losing visibility.

### 6.2 Dispatcher jobs

A dispatcher should be able to:

- see scheduled and unscheduled work;
- understand technician availability and assignment context;
- identify conflicts before they become customer problems;
- move work through permitted states;
- communicate schedule changes clearly;
- escalate issues with enough context for a fast decision.

### 6.3 Estimator jobs

An estimator should be able to:

- assemble accurate scopes quickly;
- find trusted cost information;
- reuse proven assemblies and line items;
- understand assumptions and source data;
- use AI to draft and organize without surrendering control;
- produce professional customer-facing estimates and proposals.

### 6.4 Field technician jobs

A technician should be able to:

- understand the assignment without calling the office for basic context;
- see customer, location, scope, schedule, and priority information;
- record progress and blockers with minimal friction;
- know what status change is expected next;
- avoid unnecessary administrative work.

### 6.5 Customer jobs

A customer should be able to:

- understand what is being proposed;
- see professional and consistent company branding;
- approve documents confidently;
- understand project or job status where appropriate;
- receive invoices and required information without confusion;
- trust that the contractor is organized and accountable.

## 7. The core promise

TradeOS should help an owner answer four questions quickly:

1. What needs attention today?
2. What work is scheduled, blocked, or at risk?
3. What money is waiting to be estimated, approved, invoiced, or collected?
4. What action should happen next?

If the owner cannot answer these questions quickly, the product is not yet fulfilling its central promise.

## 8. Desired customer outcomes

TradeOS should produce measurable business outcomes:

- faster estimate creation;
- more consistent pricing;
- fewer missed follow-ups;
- fewer scheduling conflicts;
- shorter time from completed work to invoice;
- improved collection visibility;
- reduced owner and dispatcher cognitive load;
- better customer communication;
- stronger accountability across office and field teams;
- less dependence on tribal knowledge.

The product should not claim an outcome unless the workflow and data support it.

## 9. Desired emotional outcomes

The product should make users feel:

- in control rather than buried;
- informed rather than surprised;
- confident rather than uncertain;
- supported rather than replaced;
- organized rather than scattered;
- respected rather than patronized by software;
- capable of running a larger operation without losing the details.

TradeOS should reduce the background anxiety created by not knowing what has been missed.

## 10. Product principles

### 10.1 Practical before impressive

Features must reduce contractor friction before they showcase technical novelty.

A simple, reliable workflow is more valuable than a sophisticated feature that requires explanation, maintenance, or constant correction.

### 10.2 AI as an invisible helper

AI should draft, summarize, rank, explain, retrieve, and prepare actions.

AI should reduce work without becoming the center of the interface.

Users should experience useful assistance, not an AI demonstration.

### 10.3 Review-first consequential actions

AI must not silently commit consequential financial, contractual, customer-facing, scheduling, or lifecycle changes.

The user should be able to see:

- what is proposed;
- what source information was used;
- what will change;
- what uncertainty remains;
- what happens after confirmation.

### 10.4 One operating system, not disconnected modules

CRM, projects, estimating, proposals, contracts, jobs, scheduling, invoicing, payments, activity, portal, settings, and branding must share lifecycle language and organization context.

A customer, project, estimate, proposal, contract, job, invoice, and payment should feel like connected stages of work rather than unrelated records.

### 10.5 Fast owner comprehension

The product should support three levels of review:

- a 30-second scan for immediate attention;
- a 3-minute operational review;
- a 15-minute decision session.

Important information should become clearer as the user goes deeper rather than requiring a deep investigation before anything is understandable.

### 10.6 Progressive depth

Simple work should stay simple.

Advanced capability should appear when needed rather than overwhelm first-time or occasional users.

The product should reveal complexity in layers:

- summary;
- explanation;
- evidence;
- action;
- advanced configuration.

### 10.7 Trust through visible control

Users must be able to understand:

- what changed;
- why it changed;
- who or what initiated it;
- when it changed;
- what will happen when they confirm an action;
- how to recover from an error where recovery is possible.

### 10.8 Operational truth over decorative dashboards

Dashboards must represent real, actionable business state.

A metric, warning, risk label, or recommendation should not exist merely because it looks useful. It must be supported by real data and a clear next action.

### 10.9 Consistency over local cleverness

Shared lifecycle terms, permissions, components, and interaction patterns are more valuable than a locally clever screen that creates a second way of doing the same work.

### 10.10 Safe defaults

Default settings and workflows should favor:

- clear accountability;
- reversible actions where possible;
- data preservation;
- organization isolation;
- explicit review;
- predictable behavior.

### 10.11 Mobile reality

Contractor software is used in offices, trucks, jobsites, and customer locations.

Essential workflows must remain understandable and usable on smaller screens, under interruption, and in imperfect working conditions.

### 10.12 Respect the contractor's language

TradeOS should use terminology contractors recognize.

Internal software terminology should not leak into customer-facing or operational workflows when a clearer trade-business term exists.

## 11. AI philosophy

### 11.1 AI should prepare, not impersonate

AI may prepare an estimate, response, summary, follow-up, schedule suggestion, or operational recommendation.

It should not pretend a human reviewed or approved something that they did not.

### 11.2 AI should expose uncertainty

Where source information is incomplete or conflicting, AI should say so and identify what is missing.

False certainty is more dangerous than a clear limitation.

### 11.3 AI should use business context

Useful assistance should account for:

- organization;
- user role;
- customer;
- project;
- job;
- estimate or document state;
- permissions;
- known cost data;
- current workflow stage.

### 11.4 AI should remain bounded by permissions

AI cannot grant itself access or perform actions the current user is not authorized to perform.

### 11.5 AI should be auditable

Consequential AI-assisted actions should preserve enough evidence to understand:

- the request;
- the relevant source context;
- the proposed action;
- the accepted or rejected outcome;
- the final writer and timestamp.

### 11.6 AI should improve through accepted work

Where appropriate and privacy-safe, TradeOS should learn from reviewed and accepted contractor choices rather than from unreviewed generated content.

The system should favor trusted organizational knowledge over generic output.

## 12. Experience doctrine

### 12.1 The morning experience

When an owner begins the day, TradeOS should help orient them immediately.

The experience should surface:

- today's schedule;
- work that needs assignment;
- jobs at risk;
- estimates or proposals waiting too long;
- work ready to invoice;
- overdue money;
- urgent tasks;
- important customer or operational exceptions;
- weather only where it creates relevant operational context.

The morning experience should not become a wall of alerts.

### 12.2 Prepared actions

TradeOS should convert information into reviewable next steps.

Examples include:

- assign this technician;
- reschedule this job;
- follow up on this estimate;
- prepare this invoice;
- review this AI-generated estimate draft;
- contact this customer;
- resolve this missing requirement.

Prepared actions should always show enough context for a responsible decision.

### 12.3 Empty, loading, error, and partial states

A reliable product explains what is happening when data is unavailable, incomplete, loading, or empty.

Blank screens and unexplained failures undermine trust.

### 12.4 Customer-facing professionalism

Proposals, contracts, invoices, portal pages, and communication should consistently represent the contractor's brand and operational competence.

Branding is not decoration. It is part of customer trust.

## 13. Competitive position

TradeOS is positioned between entry-level field-service tools and expensive enterprise suites.

It should combine:

- approachable setup;
- strong estimating and cost intelligence;
- practical dispatch and field coordination;
- customer-facing document workflows;
- transparent pricing and migration expectations;
- AI assistance that does not take control away from the contractor;
- enough operational depth to support growth beyond a very small team.

TradeOS should not win by copying every feature from a large competitor.

It should win by delivering the most important contractor workflows with better coherence, lower adoption friction, and clearer value.

## 14. The market gap

The core market gap is the contractor who has outgrown lightweight tools but is not ready for the cost, complexity, and implementation burden of a major enterprise platform.

This customer needs:

- more operational control;
- better estimating depth;
- stronger workflow continuity;
- cleaner owner visibility;
- less implementation friction;
- pricing that makes sense for a growing business.

TradeOS should own this transition point.

## 15. Product boundaries

### 15.1 What TradeOS should become

TradeOS should become:

- the operational source of truth for contractor work;
- the review layer for prepared AI assistance;
- the connection point between office, field, and customer workflows;
- a reliable system for moving work from opportunity to collected revenue;
- a platform that grows in depth without becoming unnecessarily difficult.

### 15.2 What TradeOS should not become

TradeOS is not intended to become:

- a generic ERP for every industry;
- an autonomous system that commits financial or contractual changes without review;
- a route-optimization research platform before core scheduling is stable;
- a design showcase that sacrifices operational clarity;
- a collection of unrelated feature experiments;
- an accounting replacement when integration is more appropriate;
- a social network for contractors;
- a marketplace that distracts from the core operating system;
- a custom-software project for every customer's unique process.

## 16. Business model principles

The business model should reinforce product trust.

TradeOS pricing should be:

- understandable;
- predictable;
- aligned with customer value;
- accessible to the target segment;
- free from unnecessary implementation traps;
- explicit about optional services, migration, usage, and support.

The company should avoid using complexity as a sales tactic.

## 17. Adoption principles

A contractor should be able to gain value before every historical record is migrated or every advanced setting is configured.

Adoption should proceed in useful layers:

1. establish organization and users;
2. import or create essential customer and project information;
3. activate one high-value workflow;
4. prove daily usefulness;
5. expand into connected modules;
6. deepen automation and intelligence after trust is established.

## 18. Migration philosophy

Migration from existing tools should preserve operational continuity.

TradeOS should prioritize:

- customers;
- active projects and jobs;
- open estimates and proposals;
- critical documents;
- current schedules;
- outstanding invoices and balances where supported;
- cost book and assembly knowledge.

Migration promises must match actual tooling and validation capability.

## 19. Growth thesis

TradeOS can grow through a sequence of trust:

1. solve one painful operational problem;
2. become part of the daily workflow;
3. connect adjacent workflows;
4. improve visibility across the business;
5. preserve organizational knowledge;
6. create measurable financial and operational value;
7. become difficult to replace because it is useful, not because data is trapped.

## 20. Decision framework

A proposed feature should advance at least one of these outcomes:

- win more work;
- price work more accurately;
- schedule and execute work more reliably;
- invoice and collect faster;
- reduce owner or dispatcher cognitive load;
- improve customer trust;
- strengthen operational visibility;
- preserve and reuse organizational knowledge;
- reduce preventable rework or administrative effort.

If it does none of these, it does not belong in the active roadmap.

## 21. Feature evaluation scorecard

Before entering implementation, a major feature should be evaluated against:

### Customer value

- Is the problem frequent?
- Is it costly or stressful?
- Does the target customer recognize the problem?
- Does the feature improve an existing workflow or create a necessary new one?

### Strategic fit

- Does it strengthen the contractor operating system?
- Does it reinforce the target-market position?
- Does it connect to existing lifecycle data?
- Does it avoid pulling the product into a generic or unrelated market?

### Product trust

- Is the behavior understandable?
- Can consequential actions be reviewed?
- Are errors and uncertainty visible?
- Can the system explain what happened?

### Delivery viability

- Is the underlying domain model ready?
- Are permissions and tenancy implications understood?
- Can the feature be tested realistically?
- Is required infrastructure available?
- Can it be delivered in narrow, mergeable increments?

### Business viability

- Does it improve retention, acquisition, expansion, or support efficiency?
- Does it create disproportionate implementation or support burden?
- Does it fit the intended pricing model?

## 22. Founder decision guardrails

The following decisions require explicit founder approval:

- changing the primary target customer;
- moving TradeOS into a different industry;
- allowing autonomous financial or contractual writes;
- introducing a marketplace business model;
- materially changing product pricing philosophy;
- replacing the review-first AI model;
- committing to a major external integration or vendor dependency;
- broad architecture rewrites that delay customer value;
- changing the company or product identity;
- expanding scope beyond the contractor operating-system thesis.

Agents and contributors must not infer approval from an old brainstorm or incomplete note.

## 23. Evidence hierarchy for product truth

When determining product intent, use this order:

1. explicit current founder decision;
2. this Vision volume;
3. current Product Scope and Roadmap;
4. accepted architecture and product decision records;
5. verified current implementation;
6. current research and customer evidence;
7. older drafts, archived experiments, and unmerged branches.

Older artifacts must not silently override current product direction.

## 24. Measures of success

TradeOS is succeeding when target contractors can demonstrate that it helps them:

- understand the business faster;
- move work through the lifecycle with fewer gaps;
- reduce time spent assembling estimates;
- make scheduling decisions with better context;
- reduce the delay between completion and invoicing;
- improve customer-facing professionalism;
- trust AI-prepared work because they remain in control;
- adopt additional modules without feeling trapped in complexity.

Usage alone is not enough. The product should create operational outcomes.

## 25. Vision anti-patterns

The following are warning signs of vision drift:

- building a feature because a competitor has it without validating the user problem;
- creating a new lifecycle term instead of using the canonical model;
- presenting unsupported risk scores or recommendations;
- adding AI where deterministic software is clearer and safer;
- requiring excessive setup before first value;
- hiding important behavior behind automation;
- creating multiple competing settings or branding systems without a convergence plan;
- optimizing for screenshots rather than daily use;
- expanding into unrelated industries before the core contractor workflow is strong;
- treating documentation as separate from product truth.

## 26. Vision maintenance contract

This volume should change only when product direction changes materially.

Implementation details, transient bugs, and sprint status belong elsewhere.

Every proposed update must identify:

- what principle is changing;
- why it is changing;
- what evidence supports the change;
- which product, architecture, roadmap, and sprint documents must also be updated;
- whether founder approval is required.

## 27. One-sentence product definition

TradeOS is a review-first, AI-assisted operating system that helps growing trade contractors move work from customer request to collected revenue with clearer decisions, connected workflows, and less operational friction.

## 28. Related sources

- `docs/PRODUCT_SCOPE.md`
- `docs/product/TRADEOS_OWNER_EXPERIENCE.md`
- `docs/product/TRADEOS_UX_ADVANTAGES.md`
- `docs/research/CONTRACTOR_UX_RESEARCH.md`
- `docs/ROADMAP.md`
- `docs/ARCHITECTURE.md`
- `docs/WORKFLOW_LIFECYCLES.md`
- `docs/RBAC_MATRIX.md`
- `docs/SPRINT_BACKLOG.md`
