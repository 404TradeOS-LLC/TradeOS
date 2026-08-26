---
status: archived
superseded_by: docs/README.md
do_not_use_for_implementation: true
---

# TradeOS Engineering Playbook

> This document defines how TradeOS is developed. Every feature, sprint, and engineering decision follows this playbook.

---

# Mission

TradeOS exists to reduce the time required to create professional construction proposals from hours to minutes.

Every feature should support that mission.

If a feature does not directly help contractors:
- win more work
- estimate faster
- reduce mistakes
- manage projects better

…it is lower priority.

---

# Core Product Philosophy

TradeOS is **not** trying to become another bloated contractor ERP.

TradeOS is an AI-powered preconstruction platform.

Its primary workflow is:

Lead
↓
Customer
↓
Project
↓
Site Visit
↓
AI Intake
↓
Proposal
↓
Estimate
↓
Contract
↓
Invoice

Everything should reinforce this flow.

---

# MVP Goal

A contractor should be able to:

- Create a customer
- Create a project
- Enter a simple scope of work
- Answer AI follow-up questions
- Generate a professional proposal
- Send the proposal
- Convert it into a detailed estimate later

If we achieve this, the MVP is successful.

---

# Development Philosophy

We build capabilities.

Not pages.

Not components.

Capabilities.

Example:

❌ Proposal Page

✅ Generate Proposal from Site Visit

Example:

❌ Customer Screen

✅ Manage Customer Relationships

---

# Sprint Structure

Every sprint follows exactly the same format.

## Sprint

Title:

Objective:

Files:

Definition of Done:

Tests:

Git Commit:

Next Sprint:

---

# Sprint Template

## Objective

One sentence.

No ambiguity.

Example:

Build deterministic project classification.

---

## Files

List every file expected to change.

No unnecessary edits outside this list.

---

## Definition of Done

Binary.

Either complete or incomplete.

No "almost."

---

## Tests

Every sprint includes validation.

Examples:

- Unit tests
- Manual verification
- Example contractor scopes

---

## Git Commit

Every sprint ends with a commit.

Never leave work uncommitted.

---

# Engineering Rules

## Rule 1

Finish one capability before starting another.

---

## Rule 2

Avoid giant files.

Prefer focused modules.

---

## Rule 3

Prefer composition over duplication.

---

## Rule 4

Business logic belongs in modules.

Not React components.

---

## Rule 5

The frontend should remain thin.

Business logic lives in the backend.

---

## Rule 6

Every AI feature must have deterministic fallbacks.

AI assists.

It does not own business truth.

---

## Rule 7

Never trust AI output.

Always validate.

---

## Rule 8

Every feature should be testable.

---

# Coding Standards

- TypeScript everywhere
- Strong typing
- Named exports
- Small functions
- Clear interfaces
- Reusable components
- Mobile-first UI
- Accessibility by default

---

# Folder Responsibilities

## web/

Frontend.

Everything users see.

---

## app/backend/

Express server.

Routing.

Authentication.

Middleware.

---

## app/modules/

Business logic.

Every feature belongs here.

---

## app/prisma/

Database schema.

Migrations.

Nothing else.

---

## docs/

Product documentation.

Architecture.

Roadmaps.

Sprint notes.

---

# AI Architecture

TradeOS uses AI as an assistant.

AI never replaces deterministic business rules.

Flow:

Simple Scope
↓
Classification
↓
Questions
↓
Missing Information
↓
Confidence Score
↓
Proposal Draft
↓
Detailed Estimate

LLMs improve quality.

They do not replace validation.

---

# Current North Star

Input:

"Build a 16x20 treated deck."

Output:

A contractor leaves the customer's driveway with a professional proposal that is approximately 75% complete.

The remaining 25% is completed back at the office using detailed pricing and the Cost Book.

---

# Definition of Success

The average contractor should reduce proposal creation time from approximately:

6 hours
↓
15 minutes

without sacrificing professionalism or accuracy.

---

# CTO Responsibilities (ChatGPT)

- Protect product vision
- Prevent feature creep
- Plan every sprint
- Maintain architecture
- Review implementation strategy
- Prioritize technical debt
- Keep development focused
- Update roadmap
- Define "done"

---

# Lead Engineer Responsibilities (Billy)

- Implement code
- Review AI-generated changes
- Run tests
- Commit completed work
- Ask questions early
- Keep the application shippable

---

# Working Agreement

We build one capability at a time.

We ship continuously.

We do not chase perfection.

We solve the contractor's biggest problem first.

Every sprint should move TradeOS closer to becoming the fastest way to turn a scope of work into a professional proposal.
