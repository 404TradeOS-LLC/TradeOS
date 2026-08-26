---
status: current
owner: product
last_verified: 2026-07-16
source_of_truth: true
---

# TradeOS Bible — Volume 2: Product

## 1. Purpose

This volume defines what TradeOS is as a product: who uses it, what each role is trying to accomplish, how the modules connect, what every major workflow must do, how screens should behave, and where AI may assist without taking control away from the contractor.

This is the canonical product doctrine. Module documents may provide deeper implementation detail, but they must not contradict this volume.

## 2. Product definition

TradeOS is a review-first, AI-assisted operating system for growing trade contractors. It connects the commercial, operational, field, financial, and customer-facing parts of the business from the first customer request through collected revenue.

TradeOS is not a collection of unrelated tools. Customers, projects, estimates, proposals, contracts, jobs, schedules, invoices, payments, documents, activity, branding, and settings are parts of one connected operating model.

## 3. Product outcome model

TradeOS should help a contractor accomplish seven outcomes:

1. Capture and organize customer demand.
2. Price work accurately and consistently.
3. Win approval with clear, trustworthy documents.
4. Schedule and coordinate work reliably.
5. Equip field teams with the right context.
6. Invoice and collect without losing operational history.
7. Understand what needs attention and what should happen next.

A feature that does not strengthen one of these outcomes requires explicit justification before entering the active roadmap.

## 4. Product vocabulary

Canonical product terms:

- **Organization**: the tenant boundary for one contractor business.
- **User**: an authenticated person associated with one or more organizations.
- **Customer**: the person or business buying or requesting work.
- **Contact**: a named person associated with a customer.
- **Service address**: the location where work is performed.
- **Project**: the commercial and operational container for a body of customer work.
- **Estimate**: an internal priced representation of proposed scope.
- **Proposal**: a customer-facing offer derived from approved estimate content.
- **Contract**: the accepted legal or commercial agreement governing work.
- **Job**: an executable unit of field or office-coordinated work.
- **Schedule**: the planned timing and assignment of jobs.
- **Invoice**: a request for payment tied to billable work.
- **Payment**: recorded settlement against an invoice or balance.
- **Cost book**: reusable pricing knowledge for labor, materials, equipment, subcontractors, and assemblies.
- **Assembly**: a reusable bundle of cost components representing a repeatable unit of work.
- **Activity**: an auditable record of a meaningful business event.
- **Prepared action**: an AI- or rules-assisted recommendation that remains reviewable before execution.

Product copy, APIs, lifecycle documents, and user interfaces should use these terms consistently.

## 5. Product status language

Every documented capability must be described using one of these evidence classes:

- **Implemented**: verified in merged code and current documentation.
- **Partially implemented**: usable foundation exists, but important behaviors remain incomplete.
- **Planned**: approved direction, not yet implemented.
- **Deferred**: intentionally outside the current release sequence.
- **Prohibited**: conflicts with product doctrine, security, or review-first behavior.

No roadmap or Bible document may imply that planned functionality is already available.

## 6. Primary user roles

### 6.1 Owner / administrator

The owner is accountable for business performance, exceptions, approvals, configuration, and operational visibility.

Primary jobs:

- understand what requires attention today;
- see work, money, staffing, and customer risk in one place;
- approve consequential actions;
- identify stalled estimates, proposals, jobs, invoices, and collections;
- configure organization branding, roles, and operating preferences;
- confirm that the business is moving from demand to collected revenue.

Required product behavior:

- high-signal dashboard rather than a decorative overview;
- concise attention queues with direct next actions;
- visibility into source records behind summaries;
- approval and audit context for consequential actions;
- progressive access to detail without forcing module-by-module hunting.

### 6.2 Office manager / coordinator

The office manager keeps customer, project, document, and scheduling workflows moving.

Primary jobs:

- create and update customer and project records;
- coordinate communications and documents;
- track missing information and follow-ups;
- support estimate, proposal, contract, job, and invoice transitions;
- resolve routine operational exceptions.

Required product behavior:

- fast search and navigation;
- clear ownership and status;
- visible missing-data and follow-up indicators;
- consistent forms and validation;
- safe handling of duplicate customers, addresses, and projects.

### 6.3 Dispatcher

The dispatcher converts approved work into an executable schedule.

Primary jobs:

- see scheduled and unscheduled work;
- assign and reassign technicians;
- identify conflicts, overload, and timing risk;
- reschedule quickly without losing context;
- open the source job and customer record;
- move work through permitted operational states.

Required product behavior:

- date-based and unscheduled job views;
- technician assignment and estimated duration;
- service address, priority, customer, and status visibility;
- conflict indication without pretending to provide advanced route optimization;
- reliable drag, move, or edit behavior where supported;
- audit evidence for schedule and assignment changes.

### 6.4 Estimator / salesperson

The estimator translates customer need into clear, profitable scope.

Primary jobs:

- understand customer and project context;
- assemble labor, material, equipment, subcontractor, and assembly costs;
- create accurate scope and pricing;
- preserve margin awareness;
- generate a professional proposal;
- track customer decision and follow-up.

Required product behavior:

- reusable cost knowledge;
- transparent calculations;
- clear difference between internal estimate and customer-facing proposal;
- review-first AI suggestions;
- duplicate and retry protection for accepted AI line items;
- lifecycle visibility from draft through approval or rejection.

### 6.5 Technician / field worker

The technician needs concise, actionable field context rather than the full office application.

Primary jobs:

- know where to go and when;
- understand customer, scope, instructions, and site context;
- update permitted job states;
- record notes, photos, time, materials, or completion evidence where supported;
- surface blockers to the office;
- close work accurately enough to support invoicing.

Required product behavior:

- mobile-first field views;
- large, clear controls;
- minimal navigation depth;
- resilient handling of intermittent connectivity where future offline support is approved;
- no access to unrelated financial or administrative data;
- explicit confirmation for consequential completion states.

### 6.6 Accounting / collections

Accounting users manage billing truth and payment visibility.

Primary jobs:

- identify invoice-ready work;
- create, issue, and track invoices;
- record payment status accurately;
- identify overdue or partially paid balances;
- reconcile operational status with financial status;
- preserve audit evidence.

Required product behavior:

- accurate invoice lifecycle language;
- visible totals, balances, due dates, and payment state;
- clear separation between recorded payment and public payment processing;
- no silent financial mutations;
- source links back to customer, project, job, and supporting documents.

### 6.7 Customer

The customer needs clarity, confidence, and an easy path to decision.

Primary jobs:

- understand proposed work and price;
- approve or reject documents where permitted;
- understand expectations and current state;
- access relevant documents;
- trust that branding and communication come from the contractor;
- avoid unnecessary calls for basic status questions.

Required product behavior:

- controlled, organization-branded portal access;
- plain-language documents and statuses;
- no exposure of internal cost or margin data;
- accessible approval and document viewing;
- clear confirmation after customer actions;
- secure organization and record scoping.

## 7. Product domains

### 7.1 Authentication and tenancy

Purpose:

- establish trusted identity;
- resolve organization membership;
- enforce role and tenant boundaries.

Product requirements:

- no user-selectable tenant impersonation shortcut;
- every protected action resolves organization context from trusted authentication and membership data;
- organization switching, where available, must be explicit and auditable;
- denied access must fail clearly without leaking record existence.

### 7.2 CRM

Purpose:

- capture customer identity, contacts, service locations, and relationship context.

Core capabilities:

- customer creation and editing;
- contact information;
- service addresses;
- notes and activity;
- relationship to projects and downstream work.

Product boundaries:

- CRM is contractor-focused, not a generic enterprise sales platform;
- lead scoring and complex marketing automation are deferred unless supported by explicit strategy;
- duplicate prevention and merge behavior require careful auditability.

### 7.3 Projects and workspace

Purpose:

- provide the central commercial and operational record for customer work.

A project should connect:

- customer and service address;
- estimates and proposals;
- contracts;
- jobs and scheduling;
- files and documents;
- change orders where supported;
- invoices and payment state;
- activity history.

The project workspace should answer:

- what is this work;
- where is it in the lifecycle;
- what is blocked;
- what document or action comes next;
- who owns the next step.

### 7.4 Cost book

Purpose:

- create reusable pricing consistency across estimates.

Core content:

- materials;
- labor rates;
- equipment;
- subcontractors;
- cost items;
- divisions, categories, and subcategories;
- regional pricing context where implemented.

Product requirements:

- costs and prices must remain distinguishable;
- changes to reusable pricing should not silently rewrite accepted historical documents;
- source and freshness should be visible when supplier or audit data exists;
- search should support practical contractor terminology and codes.

### 7.5 Assemblies

Purpose:

- package repeatable combinations of labor, material, equipment, and subcontractor components.

Product requirements:

- an assembly must expose its components and calculated totals;
- estimate insertion should preserve enough source context for audit and later review;
- editing an assembly definition must not silently mutate historical accepted estimate lines;
- trade-specific templates may accelerate setup without forcing every contractor into the same cost structure.

### 7.6 Estimating

Purpose:

- convert scope into internally reviewed priced work.

Core behaviors:

- create estimate;
- add, edit, reorder, and remove line items;
- use cost-book items and assemblies;
- calculate quantities, units, costs, prices, markups, margins, taxes, and totals where supported;
- preserve draft and lifecycle state;
- generate customer-facing proposal content only after review.

Acceptance requirements:

- calculations are deterministic and explainable;
- quantity and monetary bounds are validated;
- tenant and target ownership are checked;
- duplicate operations are protected;
- partial failures do not create false success.

### 7.7 AI Estimate Assist

Purpose:

- reduce estimator effort without becoming an autonomous pricing authority.

Permitted behaviors:

- interpret contractor-entered scope;
- suggest line items or assemblies;
- explain why an item may be relevant;
- summarize assumptions and missing information;
- rank likely matches;
- prepare reviewable actions.

Required controls:

- signed or otherwise trusted review context;
- organization-scoped target validation;
- active-target checks;
- bounded quantities;
- duplicate and retry guards;
- transactional apply behavior;
- accepted writes through canonical estimate services;
- no silent auto-commit.

Prohibited behaviors:

- inventing prices without a visible source or assumption;
- changing accepted financial content without confirmation;
- presenting suggestions as guaranteed scope completeness;
- bypassing service-layer validation.

### 7.8 Proposals

Purpose:

- present reviewed scope, price, terms, branding, and customer decision paths.

Product requirements:

- proposal content derives from reviewed estimate information;
- customer-facing language must not expose internal cost or margin details;
- proposal lifecycle must distinguish draft, sent, viewed, accepted, rejected, expired, and compatibility states where applicable;
- acceptance must be recorded with time and actor evidence;
- generated documents must use organization branding when the rendering path is wired to that source.

### 7.9 Contracts

Purpose:

- record the formal agreement governing accepted work.

Product requirements:

- contract generation and acceptance must preserve source project and proposal relationships;
- terms and acceptance evidence must be auditable;
- lifecycle labels must remain distinct from proposal labels;
- contract acceptance cannot be inferred solely from a proposal status unless explicitly modeled.

### 7.10 Change orders

Purpose:

- represent approved changes to scope, price, or schedule after initial agreement.

Product requirements:

- original scope remains historically intact;
- each change has reason, amount, status, and approval evidence;
- approved changes flow into the correct financial and operational totals;
- draft changes do not silently affect invoicing or job scope;
- customer-facing and internal descriptions may differ where necessary.

### 7.11 Jobs

Purpose:

- convert approved work into executable units.

Core fields:

- customer;
- project;
- service address;
- scope or work summary;
- priority;
- status;
- estimated duration;
- scheduled timing;
- assigned technicians;
- notes and completion evidence where implemented.

Product requirements:

- a job must be usable independently in the field while retaining its source relationships;
- job status transitions must follow permitted lifecycle rules;
- completion must support invoice readiness rather than automatically creating financial truth without review.

### 7.12 Scheduling and dispatch

Purpose:

- coordinate when work happens and who performs it.

Implemented baseline should support:

- jobs by scheduled date;
- unscheduled jobs;
- technician assignment;
- rescheduling;
- priority, status, customer, address, and duration context;
- conflict awareness;
- direct access to the source job;
- permitted status transitions.

Deferred unless separately approved:

- automatic route optimization;
- fleet-routing intelligence;
- autonomous technician assignment;
- predictive travel-time promises without reliable data.

### 7.13 Field execution

Purpose:

- help technicians perform and document work.

Field experience standards:

- essential information appears before secondary details;
- status changes are clear and permission-aware;
- photos, notes, time, materials, and signatures require explicit product contracts before being treated as implemented;
- office users can distinguish technician-reported facts from inferred or AI-generated summaries;
- blockers should be surfaced rather than buried in free text.

### 7.14 Invoices

Purpose:

- convert billable work into a clear request for payment.

Product requirements:

- invoice amount, due date, balance, and status are explicit;
- invoice source records remain traceable;
- lifecycle states distinguish draft, issued, partially paid, paid, overdue, void, and compatibility values where applicable;
- edits after issue require appropriate auditability;
- invoice readiness and invoice creation remain distinct concepts.

### 7.15 Payments

Purpose:

- record settlement and collection state.

Current product boundary:

- recorded payment data and lifecycle visibility may exist without public payment processing;
- the product must not imply that a payment processor is active unless live integration is verified;
- refunds, disputes, fees, and processor reconciliation require explicit implementation contracts.

### 7.16 Activity and intelligence

Purpose:

- show meaningful business history and convert operational facts into attention.

Activity requirements:

- actor;
- event;
- target record;
- timestamp;
- organization context;
- meaningful before/after or reason details where appropriate.

Intelligence requirements:

- distinguish facts, calculations, rules, and AI-generated interpretation;
- allow users to open the source record;
- avoid alarming labels unsupported by underlying data;
- rank attention using explainable criteria.

### 7.17 Founder Preview / owner dashboard

Purpose:

- demonstrate and deliver a useful morning operating experience.

Core attention areas may include only data supported by real models and queries, such as:

- unassigned jobs;
- invoice-ready work;
- overdue invoices;
- aged estimates or proposals;
- punch-list or deadline items where implemented.

Items without underlying data contracts must be labeled planned or deferred, including unsupported callout/no-show, customer escalation, parts availability, or speculative risk models.

### 7.18 Customer portal

Purpose:

- provide customers controlled access to relevant records and decisions.

Product requirements:

- secure access boundaries;
- organization branding;
- proposal, contract, invoice, and status visibility only where permitted;
- plain-language lifecycle labels;
- responsive layouts;
- confirmation after approvals or other consequential actions;
- no exposure of internal notes, costs, margins, or unrelated records.

### 7.19 Brand Studio

Purpose:

- manage durable organization identity used by customer-facing experiences.

Product requirements:

- logos and assets must persist in real storage rather than browser-local blob URLs;
- private and public storage behavior must be explicit;
- brand assets, colors, typography, and document usage must have clear source ownership;
- document and portal rendering must not claim Brand Studio integration until actually wired;
- duplicate branding systems require an architectural reconciliation plan rather than silent divergence.

### 7.20 Settings and operations

Purpose:

- configure organization-level operating preferences without exposing unsafe implementation detail.

Settings categories may include:

- organization identity;
- branding;
- roles and team;
- operational defaults;
- document preferences;
- notification preferences;
- developer or integration settings where permissioned.

Product requirements:

- settings changes are validated;
- consequential settings are auditable;
- users can distinguish saved state from staged draft state;
- unsupported settings do not appear functional merely because a control renders.

## 8. End-to-end workflow library

### 8.1 Customer request to project

Entry:

- new lead, referral, inbound request, or existing customer need.

Required flow:

1. Find or create customer.
2. Confirm contact and service address.
3. Create project or appropriate work record.
4. Record source, need, owner, and next action where supported.
5. Preserve activity evidence.

Exit:

- project exists with enough context to begin scoping.

Failure conditions:

- duplicate customer;
- missing service address;
- unauthorized organization access;
- ambiguous ownership;
- project created without usable context.

### 8.2 Project to estimate

1. Review customer and project context.
2. Capture scope and assumptions.
3. Create estimate.
4. Add line items manually, from cost book, from assemblies, or through reviewed AI assistance.
5. Validate quantities, calculations, and margin.
6. Resolve missing information.
7. Mark estimate ready for internal approval or proposal generation.

### 8.3 AI-assisted estimate workflow

1. User provides scope or prompt.
2. AI produces structured suggestions and assumptions.
3. System displays source, confidence, and unresolved questions where available.
4. User selects accepted suggestions.
5. Apply request revalidates token, organization, target, target state, quantities, and duplicates.
6. Transaction writes accepted lines through canonical estimate service.
7. Failure rolls back partial writes.
8. Activity records successful accepted changes.

### 8.4 Estimate to proposal

1. Confirm estimate is internally reviewed.
2. Select customer-visible scope and terms.
3. Apply current organization branding where wired.
4. Generate proposal preview.
5. Resolve errors or missing content.
6. Issue proposal.
7. Track view and decision state where implemented.

### 8.5 Proposal decision

Accepted:

- record customer decision evidence;
- preserve accepted version;
- prepare contract and/or job creation according to workflow;
- create next action.

Rejected:

- record state and reason where available;
- preserve proposal history;
- permit revision through a new or versioned workflow rather than erasing history.

Expired or stale:

- surface for follow-up;
- do not imply customer rejection without evidence.

### 8.6 Accepted work to contract and job

1. Confirm accepted commercial source.
2. Generate or associate contract when required.
3. Create one or more executable jobs.
4. Assign scope, service location, priority, duration, and operational ownership.
5. Leave jobs unscheduled until timing and capacity are confirmed.

### 8.7 Job scheduling

1. Dispatcher reviews unscheduled work.
2. Opens job detail and required context.
3. Chooses technician and date/time.
4. System checks visible conflicts and duration overlap.
5. Dispatcher confirms assignment.
6. Schedule and activity update atomically where possible.
7. Technician receives updated work context through supported channels.

### 8.8 Field execution

1. Technician reviews assignment.
2. Technician travels and begins work according to permitted states.
3. Technician reviews scope and instructions.
4. Technician records supported completion evidence.
5. Blockers are surfaced to office.
6. Job moves to completed or invoice-ready state according to lifecycle rules.

### 8.9 Completion to invoice

1. Office reviews completed work and supporting evidence.
2. Confirms billable scope and approved changes.
3. Resolves missing time, material, change-order, or document information.
4. Creates invoice draft.
5. Reviews totals, due terms, branding, and customer information.
6. Issues invoice.
7. Activity and portal state update where permitted.

### 8.10 Invoice to payment

1. Track issued invoice.
2. Surface due and overdue state.
3. Record partial or full payments.
4. Recalculate balance deterministically.
5. Preserve payment and adjustment evidence.
6. Mark invoice paid only when balance and policy support it.
7. Close or archive operational attention without destroying history.

### 8.11 Change-order workflow

1. Identify scope change.
2. Create change-order draft.
3. Record reason, scope, price, and schedule impact.
4. Review internally.
5. Present to customer if required.
6. Record decision.
7. Apply approved changes to relevant operational and financial records.
8. Preserve rejected or superseded versions.

## 9. Screen families

### 9.1 Dashboard

Must support:

- fast morning scan;
- attention ranking;
- source-record navigation;
- loading, empty, error, and populated states;
- no fabricated operational claims;
- responsive layout.

### 9.2 List and queue screens

Examples:

- customers;
- projects;
- estimates;
- proposals;
- jobs;
- invoices;
- attention queues.

Required behaviors:

- useful default sort;
- search and filters where scale requires them;
- visible status and ownership;
- empty-state next action;
- retained context when returning from a record where feasible;
- no inaccessible horizontal overflow on mobile.

### 9.3 Record detail screens

Required structure:

- identity and status;
- key actions;
- related records;
- history or activity;
- errors and missing-data warnings;
- permission-aware controls;
- consistent destructive-action confirmation.

### 9.4 Forms and editors

Required behaviors:

- explicit labels;
- understandable validation;
- staged versus saved state clarity;
- disabled and loading states;
- protection against duplicate submission;
- preservation of user input when recoverable errors occur;
- keyboard and screen-reader accessibility.

### 9.5 Document previews

Required behaviors:

- visible document identity and version;
- organization branding only when sourced correctly;
- customer-safe content;
- print and PDF consistency where supported;
- no claim of finality for unsaved or draft content.

### 9.6 Scheduling workspace

Required behaviors:

- scheduled and unscheduled work;
- dates and technician context;
- conflicts;
- direct job navigation;
- rescheduling feedback;
- usable density without sacrificing readability.

### 9.7 Mobile field screens

Required behaviors:

- single-column priority;
- large targets;
- essential context first;
- reduced typing where practical;
- safe photo or voice capture only when implemented;
- visible sync or failure state for network-sensitive actions.

## 10. Universal UI states

Every production screen must account for:

- initial loading;
- background refresh;
- empty state;
- populated state;
- partial data;
- recoverable error;
- terminal error;
- permission denied;
- stale or conflicting update;
- offline or unavailable dependency where relevant;
- success confirmation.

A page that only handles the populated happy path is not product-complete.

## 11. Navigation model

Navigation should follow contractor mental models rather than database structure.

Primary navigation should lead users toward:

- today and attention;
- customers and work;
- estimating and sales;
- scheduling and field execution;
- billing and collections;
- settings and administration.

Cross-record links should allow natural movement:

- customer → project;
- project → estimate/proposal/job/invoice;
- job → customer/project/schedule;
- invoice → source work and customer;
- activity → source record.

Users should not need to remember internal IDs or module boundaries.

## 12. Search and command behavior

Search should prioritize:

- customer name;
- project name or number;
- service address;
- estimate/proposal/invoice identifiers;
- job summary;
- cost-book code and name.

Command or global navigation tools should:

- reveal only authorized records and actions;
- distinguish navigation from mutation;
- avoid executing consequential actions without confirmation;
- tolerate contractor language and common abbreviations where practical.

## 13. AI product behavior

### 13.1 AI may

- draft;
- summarize;
- classify;
- rank;
- suggest;
- explain;
- identify missing information;
- prepare actions;
- normalize contractor-entered language;
- assist with retrieval from authorized organization knowledge.

### 13.2 AI must

- identify itself as assistance rather than source truth;
- expose important assumptions;
- remain within organization scope;
- preserve user control;
- require review before consequential writes;
- fail safely when confidence or source data is insufficient;
- route accepted changes through canonical domain services.

### 13.3 AI must not

- commit contracts, prices, invoices, payments, or schedule changes autonomously;
- invent customers, jobs, costs, supplier availability, or business risk as facts;
- bypass permissions or RLS;
- hide meaningful uncertainty;
- silently alter historical records;
- turn a recommendation into a completed action merely because the user opened a screen.

## 14. Prepared actions

A prepared action is stronger than a suggestion but weaker than an executed mutation.

It should contain:

- proposed action;
- target record;
- reason;
- expected effect;
- important assumptions;
- required confirmation;
- conflict or validation warnings;
- ability to inspect the source record.

Prepared actions should reduce user effort without obscuring responsibility.

## 15. Notifications and communication

Notification channels may include in-app, email, SMS, and push only when implementation and consent are verified.

Notification principles:

- send information that changes a decision or required action;
- avoid duplicate alerts across channels;
- respect organization preferences and customer consent;
- include enough context to understand the issue;
- link to the authoritative record;
- preserve delivery and failure evidence where consequential.

Examples of potentially valuable notifications:

- proposal viewed or accepted;
- job assignment or schedule change;
- work ready for invoicing;
- invoice due or overdue;
- customer approval required;
- integration or upload failure.

Quiet hours, escalation, and channel preferences are planned behaviors unless verified as implemented.

## 16. Permissions and visibility

Permissions must combine:

- authenticated identity;
- organization membership;
- role or capability;
- record ownership or relationship where required;
- lifecycle restrictions;
- database policy.

Product requirements:

- hide or disable unauthorized actions consistently;
- backend enforcement remains authoritative;
- customers never see internal financial structure;
- technicians see only necessary operational context;
- sensitive organization configuration is limited to authorized roles;
- permission failure messages do not leak cross-tenant data.

## 17. Lifecycle consistency

Lifecycle state must be consistent across:

- database values;
- API contracts;
- domain services;
- user interface labels;
- filters and dashboards;
- customer portal language;
- documents;
- activity history.

Compatibility values may exist temporarily, but they must be mapped explicitly and must not become permanent competing vocabularies.

No product surface should infer a later lifecycle state solely from a loosely related earlier state.

## 18. Documents and branding

Customer-facing documents should include, where supported:

- organization identity;
- customer identity;
- project or work identity;
- document type and number;
- issue and validity dates;
- clear scope and totals;
- terms;
- acceptance or payment state;
- version or audit evidence.

Branding requirements:

- durable asset storage;
- correct source of truth;
- accessible contrast and fallback behavior;
- consistency across web preview and generated document;
- no unsupported claim that all documents use Brand Studio until the rendering paths are wired.

## 19. Mobile product doctrine

Mobile is not a compressed desktop application.

Mobile priorities:

1. today’s assigned work;
2. customer and location context;
3. scope and instructions;
4. status actions;
5. evidence capture;
6. blocker communication.

Administrative tables, bulk configuration, and complex estimate editing may remain desktop-first unless a verified field use case requires otherwise.

## 20. Accessibility doctrine

TradeOS must support:

- semantic heading hierarchy;
- keyboard operation;
- visible focus;
- labeled controls;
- understandable errors;
- adequate contrast;
- non-color-only status communication;
- responsive zoom and reflow;
- descriptive alternative text for meaningful images;
- reduced-motion respect where applicable.

Accessibility defects in core workflows are product defects, not optional polish.

## 21. Data trust and auditability

Users should be able to answer:

- where did this value come from;
- when was it changed;
- who or what changed it;
- was it suggested or confirmed;
- which source record supports it;
- can it be reversed or corrected.

Consequential product areas requiring strong auditability:

- estimates and pricing;
- proposal and contract decisions;
- schedule and assignment changes;
- invoice and payment state;
- settings and permissions;
- AI-applied mutations;
- customer approvals.

## 22. Error and recovery experience

Errors should:

- explain what failed in user language;
- preserve recoverable input;
- identify whether retry is safe;
- avoid duplicate writes;
- provide the next practical action;
- log sufficient technical context without exposing secrets.

The product must distinguish:

- validation error;
- permission error;
- conflict or stale update;
- unavailable dependency;
- network failure;
- unexpected internal error.

## 23. Performance expectations

Product performance should prioritize perceived responsiveness in high-frequency workflows:

- dashboard and attention load;
- customer/project search;
- estimate editing;
- schedule changes;
- field job open and update;
- document preview;
- invoice lookup.

Loading indicators must not conceal permanently slow or failed operations. Performance budgets and exact service-level objectives belong in engineering doctrine and production readiness work.

## 24. Integrations

Integration principles:

- integration state must be visible;
- imported data retains source identity;
- retries are idempotent where possible;
- partial sync does not masquerade as completeness;
- users can understand what TradeOS owns versus what an external system owns;
- migrations from competitor systems preserve important historical relationships.

Strategic integration candidates include accounting, supplier data, communications, payments, maps, calendars, and storage, but each remains planned until implementation is verified.

## 25. Migration and onboarding

Onboarding should minimize the time between account creation and first useful workflow.

Core sequence:

1. establish organization identity;
2. establish owner access;
3. configure essential business and branding settings;
4. add team and roles;
5. import or create customers and cost knowledge;
6. create first project and estimate;
7. guide the user to a completed value loop.

Migration principles:

- preserve source-system references;
- identify unsupported data before import;
- avoid silent truncation;
- provide reconciliation evidence;
- allow phased adoption rather than requiring a disruptive all-at-once cutover.

## 26. Product analytics

Product analytics should answer whether TradeOS is reducing friction and moving revenue workflows forward.

Potential measures:

- time to first customer/project/estimate;
- estimate creation time;
- proposal acceptance rate;
- age of open estimates and proposals;
- unscheduled job age;
- schedule conflict rate;
- time from completion to invoice;
- invoice collection time;
- prepared-action acceptance and correction rate;
- feature abandonment and error rate.

Analytics must remain organization-safe and respect privacy and consent requirements.

## 27. Product quality gates

A feature is not ready merely because code exists.

Required quality evidence:

- correct role and tenant behavior;
- loading, empty, populated, error, and denied states;
- responsive behavior for expected devices;
- accessible interaction;
- deterministic calculations where applicable;
- lifecycle consistency;
- audit evidence for consequential actions;
- documentation updated;
- automated validation proportional to risk;
- real-environment verification when external infrastructure is central.

## 28. Product anti-patterns

Avoid:

- dashboards filled with vanity metrics;
- fake demo data presented as live business truth;
- autonomous AI mutations;
- status labels that differ by screen;
- duplicate sources of truth;
- hidden errors and silent fallback;
- settings controls that do not persist;
- document branding claims unsupported by rendering paths;
- desktop tables squeezed onto phones;
- workflow dead ends;
- features built because competitors have them without a contractor outcome;
- broad architecture redesign disguised as a small feature.

## 29. Current implemented baseline

Verified repository documentation identifies implemented foundations across:

- authentication and tenancy;
- CRM;
- projects and workspace;
- cost book and assemblies;
- estimating;
- AI Estimate Assist;
- proposals;
- contracts;
- invoices and payment records;
- jobs and scheduling;
- activity and intelligence;
- Brand Studio;
- settings and operations;
- customer portal.

Each module still has release-hardening caveats documented in `CURRENT_STATE.md` and the module documents. This volume does not erase those caveats.

## 30. Current product priorities

1. Lifecycle normalization.
2. Founder Preview usefulness grounded in real data.
3. Durable branding and document consistency.
4. Customer portal hardening.
5. Estimating and AI-assist production hardening.
6. Dispatcher and field-work stabilization.
7. Invoice and collection workflow clarity.
8. Production environment and integration verification.

Priority order is governed by the executable sprint backlog, not by this list alone.

## 31. Deferred product areas

Deferred until core workflows are stable and separately approved:

- autonomous route optimization;
- broad fleet management;
- speculative job-risk scoring without reliable data;
- automatic supplier availability promises;
- generic ERP expansion outside the trades;
- autonomous pricing, contracting, invoicing, payment, or scheduling;
- unsupported offline-first promises;
- complex marketing automation unrelated to the primary operating loop.

## 32. Product decision checklist

Before approving a product change, answer:

1. Which user role benefits?
2. Which contractor outcome improves?
3. What source data supports the behavior?
4. Is the capability implemented, planned, or deferred?
5. What lifecycle states are affected?
6. What permissions apply?
7. What audit evidence is required?
8. What are the loading, empty, error, denied, and conflict states?
9. Does mobile use matter?
10. Is AI involved, and if so, where is review required?
11. Does this duplicate another module or source of truth?
12. What must be documented and tested?

If these questions cannot be answered, implementation should stop for clarification.

## 33. Canonical product promise

TradeOS helps growing trade contractors turn customer demand into accurately priced, reliably scheduled, professionally delivered, and promptly collected work—without forcing owners and teams to fight disconnected software or surrender control to automation.

## 34. Related sources

- `docs/TRADEOS_BIBLE.md`
- `docs/bible/VOLUME_1_VISION.md`
- `docs/PRODUCT_SCOPE.md`
- `docs/CURRENT_STATE.md`
- `docs/DOMAIN_MODEL.md`
- `docs/WORKFLOW_LIFECYCLES.md`
- `docs/RBAC_MATRIX.md`
- `docs/API_REFERENCE.md`
- `docs/modules/`
- `docs/product/FOUNDER_PREVIEW_EXPERIENCE_SPEC.md`
- `docs/product/TRADEOS_OWNER_EXPERIENCE.md`
- `docs/product/TRADEOS_UX_ADVANTAGES.md`
- `docs/research/CONTRACTOR_UX_RESEARCH.md`
- `docs/SPRINT_BACKLOG.md`
